const Bull = require('bull');
const IORedis = require('ioredis');
const router = require('../router');
const config = require('../config');
const logger = require('../utils/logger');
const { attachErrorMetadata, userFacingError } = require('../utils/errors');
const { canonicalizeUrl, detectPlatform, downloadFingerprint } = require('../utils/urlDetector');
const fs = require('fs');
const { fileInfo, findJobFile, newJobId } = require('../utils/fileHelper');
const { sendWebhook } = require('./webhook');

const jobs = new Map();
const jobsByFingerprint = new Map();
let bullQueue = null;
let backend = 'memory';

function expiryTimestamp() {
  return new Date(Date.now() + config.fileExpireMinutes * 60 * 1000).toISOString();
}

function publicJob(job, extra = {}) {
  return {
    job_id: job.id,
    fingerprint: job.fingerprint,
    canonical_url: job.canonical_url,
    status: job.status,
    progress: job.progress,
    speed: job.speed || null,
    eta: job.eta || null,
    engine_used: job.engine_used || null,
    platform: job.platform,
    file: job.file || (job.filePath ? fileInfo(job.filePath) : null),
    error: job.error || null,
    error_code: job.error_code || null,
    attempts: job.attempts || [],
    reused: Boolean(extra.reused),
    created_at: job.created_at,
    updated_at: job.updated_at,
    expires_at: job.expires_at || null
  };
}

function updateJob(id, patch) {
  const current = jobs.get(id);
  if (!current) return null;
  const updated = { ...current, ...patch, updated_at: new Date().toISOString() };
  jobs.set(id, updated);
  return updated;
}

function deleteJobArtifacts(jobOrId) {
  const job = typeof jobOrId === 'string' ? jobs.get(jobOrId) : jobOrId;
  if (!job) return false;
  const paths = [
    job.file?.path,
    job.filePath,
    findJobFile(job.id)?.path
  ].filter(Boolean);
  for (const filePath of new Set(paths)) {
    fs.rmSync(filePath, { recursive: true, force: true });
  }
  jobs.delete(job.id);
  if (job.fingerprint && jobsByFingerprint.get(job.fingerprint) === job.id) jobsByFingerprint.delete(job.fingerprint);
  return true;
}

function scheduleJobCleanup(id, delayMs = config.sentFileExpireSeconds * 1000) {
  setTimeout(() => {
    if (deleteJobArtifacts(id)) logger.info('sent_job_removed', { id });
  }, Math.max(0, delayMs)).unref?.();
}

async function processJob(id) {
  const job = jobs.get(id);
  if (!job) throw new Error(`Unknown job ${id}`);
  updateJob(id, { status: 'downloading', progress: 10 });
  try {
    const result = await router.download(job.url, { ...job.options, jobId: id });
    const finished = updateJob(id, {
      status: 'ready',
      progress: 100,
      engine_used: result.engine,
      platform: result.platform || job.platform,
      file: result.file || findJobFile(id),
      remote_url: result.remote_url || null,
      picker: result.picker || null,
      attempts: result.fallback_failures || [],
      expires_at: expiryTimestamp()
    });
    await sendWebhook(job.options.webhook_url, { success: true, job: publicJob(finished) });
    return finished;
  } catch (error) {
    attachErrorMetadata(error);
    const failed = updateJob(id, {
      status: 'failed',
      progress: 100,
      error: userFacingError(error),
      error_code: error.code,
      attempts: Array.isArray(error.details) ? error.details : []
    });
    await sendWebhook(job.options.webhook_url, { success: false, job: publicJob(failed) });
    throw error;
  }
}

function runMemoryJob(id) {
  setImmediate(() => {
    processJob(id).catch((error) => logger.warn('memory_job_failed', { id, error: error.message }));
  });
}

async function canConnectRedis() {
  if (config.queueBackend === 'memory') return false;
  const redis = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true
  });
  redis.on('error', (error) => {
    logger.debug('redis_probe_failed', { error: error.message });
  });
  try {
    await redis.connect();
    await redis.ping();
    return true;
  } catch {
    return false;
  } finally {
    redis.disconnect();
  }
}

async function initQueue() {
  if (await canConnectRedis()) {
    bullQueue = new Bull('media-downloads', config.redisUrl, {
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100
      }
    });
    bullQueue.process(config.maxConcurrentDownloads, async (bullJob) => processJob(bullJob.data.id));
    backend = 'bull';
    logger.info('queue_ready', { backend });
  } else {
    backend = 'memory';
    logger.warn('queue_using_memory_backend');
  }
}

function reusableJobForFingerprint(fingerprint) {
  const existingId = jobsByFingerprint.get(fingerprint);
  if (!existingId) return null;
  const existing = jobs.get(existingId);
  if (!existing) {
    jobsByFingerprint.delete(fingerprint);
    return null;
  }
  if (['queued', 'downloading', 'processing', 'ready'].includes(existing.status)) {
    return existing;
  }
  jobsByFingerprint.delete(fingerprint);
  return null;
}

async function enqueueDownload(url, options = {}) {
  const canonicalUrl = canonicalizeUrl(url);
  const fingerprint = downloadFingerprint(canonicalUrl, options);
  const existing = reusableJobForFingerprint(fingerprint);
  if (existing) return publicJob(existing, { reused: true });

  const id = newJobId('job');
  const now = new Date().toISOString();
  jobs.set(id, {
    id,
    url,
    canonical_url: canonicalUrl,
    fingerprint,
    options,
    status: 'queued',
    progress: 0,
    platform: detectPlatform(url),
    created_at: now,
    updated_at: now
  });
  jobsByFingerprint.set(fingerprint, id);

  if (backend === 'bull' && bullQueue) {
    await bullQueue.add({ id });
  } else {
    runMemoryJob(id);
  }
  return publicJob(jobs.get(id));
}

function getJob(id) {
  const job = jobs.get(id);
  return job ? publicJob(job) : null;
}

function listJobs(options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit) || 50, 200));
  const status = options.status || null;
  return Array.from(jobs.values())
    .filter((job) => !status || job.status === status)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit)
    .map((job) => publicJob(job));
}

function waitForJob(id, options = {}) {
  const timeoutMs = options.timeoutMs || 180000;
  const intervalMs = options.intervalMs || 2000;
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const check = () => {
      const job = getJob(id);
      if (!job) return resolve(null);
      if (['ready', 'failed'].includes(job.status)) return resolve(job);
      if (Date.now() - startedAt >= timeoutMs) return resolve(job);
      setTimeout(check, intervalMs);
    };
    check();
  });
}

function cleanupExpiredJobs(now = Date.now()) {
  let removed = 0;
  for (const [id, job] of jobs.entries()) {
    const expiredByTime = job.expires_at && Date.parse(job.expires_at) <= now;
    const missingReadyFile = job.status === 'ready' && job.file?.path && !fileInfo(job.file.path);
    const oldFailed = job.status === 'failed' && Date.parse(job.updated_at || job.created_at) + config.fileExpireMinutes * 60 * 1000 <= now;
    if (!expiredByTime && !missingReadyFile && !oldFailed) continue;
    jobs.delete(id);
    if (job.fingerprint && jobsByFingerprint.get(job.fingerprint) === id) {
      jobsByFingerprint.delete(job.fingerprint);
    }
    removed += 1;
  }
  if (removed) logger.info('cleanup_removed_jobs', { removed });
  return removed;
}

async function stats() {
  if (backend === 'bull' && bullQueue) {
    const [active, waiting] = await Promise.all([bullQueue.getActiveCount(), bullQueue.getWaitingCount()]);
    return { backend, active, waiting };
  }
  return {
    backend,
    active: Array.from(jobs.values()).filter((job) => ['downloading', 'processing'].includes(job.status)).length,
    waiting: Array.from(jobs.values()).filter((job) => job.status === 'queued').length,
    total: jobs.size
  };
}

module.exports = {
  cleanupExpiredJobs,
  deleteJobArtifacts,
  enqueueDownload,
  getJob,
  initQueue,
  listJobs,
  publicJob,
  scheduleJobCleanup,
  stats,
  waitForJob
};
