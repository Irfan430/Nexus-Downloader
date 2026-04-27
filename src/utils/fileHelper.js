const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const config = require('../config');

function ensureDirectories() {
  fs.mkdirSync(config.downloadDir, { recursive: true });
  fs.mkdirSync(config.logDir, { recursive: true });
}

function safeExt(ext, fallback = 'bin') {
  return String(ext || fallback).replace(/[^a-z0-9]/gi, '').toLowerCase() || fallback;
}

function buildDownloadPath(jobId, ext = 'bin') {
  const filename = `${jobId}.${safeExt(ext)}`;
  return path.join(config.downloadDir, filename);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)}${units[index]}`;
}

function fileInfo(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  return {
    path: filePath,
    filename: path.basename(filePath),
    size: stat.size,
    size_human: formatBytes(stat.size),
    created_at: stat.birthtime.toISOString()
  };
}

function findJobFile(jobId) {
  if (!jobId || !fs.existsSync(config.downloadDir)) return null;
  const exact = fs.readdirSync(config.downloadDir)
    .filter((entry) => entry === jobId || entry.startsWith(`${jobId}.`) || entry.startsWith(`${jobId}-`))
    .map((entry) => path.join(config.downloadDir, entry))
    .filter((entryPath) => fs.existsSync(entryPath))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  return exact ? fileInfo(exact) : null;
}

function writeMockMediaFile(jobId, extension = 'txt', sourceUrl = '') {
  ensureDirectories();
  const filePath = buildDownloadPath(jobId, extension);
  fs.writeFileSync(filePath, `Mock media artifact for ${sourceUrl}\nGenerated at ${new Date().toISOString()}\n`);
  return filePath;
}

function newJobId(prefix = 'job') {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

module.exports = {
  ensureDirectories,
  buildDownloadPath,
  findJobFile,
  fileInfo,
  formatBytes,
  newJobId,
  safeExt,
  writeMockMediaFile
};
