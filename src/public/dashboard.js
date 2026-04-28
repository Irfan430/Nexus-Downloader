const state = {
  filter: 'all',
  jobs: [],
  choices: [],
  videoChoices: [],
  audioChoices: [],
  mode: 'video',
  selected: null,
  preview: null,
  pollers: new Map()
};

const els = {
  url: document.querySelector('#url'),
  pasteBtn: document.querySelector('#pasteBtn'),
  inspectBtn: document.querySelector('#inspectBtn'),
  inspectStatus: document.querySelector('#inspectStatus'),
  qualitySection: document.querySelector('#qualitySection'),
  qualityChoices: document.querySelector('#qualityChoices'),
  downloadBtn: document.querySelector('#downloadBtn'),
  modeTabs: document.querySelectorAll('.mode-tab'),
  preview: document.querySelector('#mediaPreview'),
  previewImg: document.querySelector('#previewImg'),
  previewTitle: document.querySelector('#previewTitle'),
  previewMeta: document.querySelector('#previewMeta'),
  previewPlatform: document.querySelector('#previewPlatform'),
  health: document.querySelector('#health'),
  refreshBtn: document.querySelector('#refreshBtn'),
  jobs: document.querySelector('#jobs'),
  filters: document.querySelectorAll('.filter'),
  backendMetric: document.querySelector('#backendMetric'),
  activeMetric: document.querySelector('#activeMetric'),
  waitingMetric: document.querySelector('#waitingMetric'),
  totalMetric: document.querySelector('#totalMetric'),
  uptime: document.querySelector('#uptime'),
  engines: document.querySelector('#engines'),
  activity: document.querySelector('#activity'),
  clearActivityBtn: document.querySelector('#clearActivityBtn'),
  toast: document.querySelector('#toast')
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function shorten(url, max = 60) {
  if (!url) return '';
  if (url.length <= max) return url;
  return url.slice(0, max - 1) + '…';
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return null;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
}

let toastTimer;
function toast(message, kind = '') {
  els.toast.textContent = message;
  els.toast.className = `toast show ${kind}`.trim();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
  }, 3500);
}

function logActivity(message, level = 'info') {
  const item = document.createElement('div');
  item.className = level;
  item.textContent = `${new Date().toLocaleTimeString()}  ${message}`;
  els.jobs.prepend(item);
  while (els.jobs.children.length > 60) els.jobs.lastElementChild.remove();
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

function setLoading(button, loading) {
  if (!button) return;
  if (loading) button.classList.add('is-loading');
  else button.classList.remove('is-loading');
  button.disabled = loading;
}

function buttonHtml(job) {
  const buttons = [];
  if (job.file) {
    const filename = job.file.filename || `${job.job_id}.bin`;
    buttons.push(`
      <button type="button" class="action-btn" data-download="${escapeHtml(job.job_id)}" data-filename="${escapeHtml(filename)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Save (${escapeHtml(job.file.size_human || '')})
      </button>
    `);
  }
  if (job.remote_url) {
    buttons.push(`<a class="action-btn outline" href="${escapeHtml(job.remote_url)}" target="_blank" rel="noreferrer">Open Source</a>`);
  }
  return buttons.join('');
}

function jobCard(job) {
  const status = String(job.status || 'unknown').toLowerCase();
  const progress = Math.max(0, Math.min(100, Number(job.progress || 0)));
  const platform = job.platform || 'media';
  const url = shorten(job.canonical_url || '', 80);
  const error = job.error ? `<div class="error-msg">${escapeHtml(job.error)}</div>` : '';
  return `
    <article class="job">
      <div class="job-head">
        <div class="job-title">
          <strong>${escapeHtml(platform.toUpperCase())} <span class="status-badge ${escapeHtml(status)}"><span class="dot"></span>${escapeHtml(status)}</span></strong>
          <span class="job-url">${escapeHtml(url)}</span>
        </div>
      </div>
      <div class="progress" aria-label="progress"><span style="width:${progress}%"></span></div>
      <div class="job-meta">
        <span class="tag">${escapeHtml(job.engine_used || 'pending')}</span>
        <span class="tag">${progress}%</span>
        ${job.expires_at ? `<span class="tag">expires ${escapeHtml(new Date(job.expires_at).toLocaleTimeString())}</span>` : ''}
      </div>
      ${error}
      <div class="job-actions">${buttonHtml(job)}</div>
    </article>
  `;
}

function visibleJobs() {
  if (state.filter === 'all') return state.jobs;
  if (state.filter === 'active') {
    return state.jobs.filter((job) => ['queued', 'downloading', 'processing'].includes(job.status));
  }
  return state.jobs.filter((job) => job.status === state.filter);
}

function renderJobs() {
  const list = visibleJobs();
  els.jobs.innerHTML = list.length
    ? list.map(jobCard).join('')
    : '<p class="empty">No jobs match this filter yet.</p>';
}

function setHealthState(data) {
  const ok = data?.status === 'ok';
  els.health.className = `pill pill-status ${ok ? 'online' : 'degraded'}`;
  els.health.querySelector('.label').textContent = ok ? 'Online' : 'Degraded';
  els.backendMetric.textContent = data?.queue?.backend || '—';
  els.activeMetric.textContent = data?.queue?.active ?? 0;
  els.waitingMetric.textContent = data?.queue?.waiting ?? 0;
  els.totalMetric.textContent = data?.queue?.total ?? 0;
  els.uptime.textContent = data?.uptime ? `up ${data.uptime}` : '—';
  els.engines.innerHTML = Object.entries(data?.engines || {}).map(([name, status]) => {
    const cls = status === 'online' ? 'online' : 'offline';
    return `<div class="engine"><strong>${escapeHtml(name)}</strong><span class="engine-status ${cls}"><span class="dot"></span>${escapeHtml(status)}</span></div>`;
  }).join('');
}

function renderChoices() {
  const list = state.mode === 'audio' ? state.audioChoices : state.videoChoices;
  if (!list.length) {
    els.qualityChoices.innerHTML = '<p class="empty-choices">No qualities available for this mode.</p>';
    state.selected = null;
    els.downloadBtn.disabled = true;
    return;
  }
  els.qualityChoices.innerHTML = list.map((choice, index) => {
    const active = state.selected === index ? ' active' : '';
    const meta = [choice.type, choice.description].filter(Boolean).join(' · ');
    return `
      <button class="quality-choice${active}" type="button" data-choice="${index}">
        <strong>${escapeHtml(choice.label)}</strong>
        <span>${escapeHtml(meta)}</span>
      </button>
    `;
  }).join('');
  els.downloadBtn.disabled = state.selected === null;
}

function showPreview(info) {
  if (!info) {
    els.preview.classList.add('hidden');
    state.preview = null;
    return;
  }
  state.preview = info;
  els.previewImg.src = info.thumbnail || '';
  els.previewImg.alt = info.title || '';
  els.previewTitle.textContent = info.title || 'Untitled';
  const bits = [];
  if (info.uploader) bits.push(info.uploader);
  const dur = formatDuration(info.duration);
  if (dur) bits.push(dur);
  const views = formatNumber(info.view_count);
  if (views) bits.push(`${views} views`);
  els.previewMeta.textContent = bits.join(' · ') || '—';
  els.previewPlatform.textContent = info.platform || '';
  els.preview.classList.remove('hidden');
}

async function inspect() {
  const url = els.url.value.trim();
  if (!url) {
    toast('Paste a media link first', 'error');
    els.url.focus();
    return;
  }
  setLoading(els.inspectBtn, true);
  els.inspectStatus.className = 'inspect-status muted';
  els.inspectStatus.textContent = 'Inspecting…';
  try {
    const data = await request(`/formats?url=${encodeURIComponent(url)}`);
    state.choices = data.choices || [];
    state.videoChoices = state.choices.filter((c) => c.type === 'video');
    state.audioChoices = state.choices.filter((c) => c.type === 'audio');
    state.selected = state.videoChoices.length ? 0 : (state.audioChoices.length ? 0 : null);
    state.mode = state.videoChoices.length ? 'video' : 'audio';
    syncModeTabs();

    let info = null;
    try { info = await request(`/info?url=${encodeURIComponent(url)}`); } catch { /* preview optional */ }
    showPreview(info ? {
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      uploader: info.uploader,
      view_count: info.view_count,
      platform: data.platform || info.platform
    } : null);

    if (!state.choices.length) {
      els.qualitySection.classList.add('hidden');
      els.inspectStatus.className = 'inspect-status error';
      els.inspectStatus.textContent = 'No selectable formats. Try Download with default quality.';
      return;
    }
    els.qualitySection.classList.remove('hidden');
    renderChoices();
    els.inspectStatus.className = 'inspect-status success';
    els.inspectStatus.textContent = `${state.choices.length} options ready · ${data.platform || 'media'}`;
    logActivity(`Inspected ${data.platform || 'media'} — ${state.choices.length} formats`, 'success');
  } catch (error) {
    els.qualitySection.classList.add('hidden');
    showPreview(null);
    els.inspectStatus.className = 'inspect-status error';
    els.inspectStatus.textContent = error.message;
    toast(error.message, 'error');
    logActivity(`Inspect failed: ${error.message}`, 'failed');
  } finally {
    setLoading(els.inspectBtn, false);
  }
}

function syncModeTabs() {
  els.modeTabs.forEach((tab) => {
    const active = tab.dataset.mode === state.mode;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

async function startDownload() {
  const url = els.url.value.trim();
  if (!url) return;
  const list = state.mode === 'audio' ? state.audioChoices : state.videoChoices;
  const selected = state.selected != null ? list[state.selected] : null;
  const audioMode = state.mode === 'audio' || selected?.options?.audio_only;
  const endpoint = audioMode ? '/audio' : '/download';
  const opts = selected?.options || {};
  const body = {
    url,
    quality: opts.quality || (audioMode ? '320k' : 'best'),
    format: opts.format || (audioMode ? 'mp3' : 'mp4'),
    format_id: opts.format_id,
    no_watermark: opts.no_watermark !== false
  };

  setLoading(els.downloadBtn, true);
  try {
    const result = await request(endpoint, { method: 'POST', body: JSON.stringify(body) });
    toast(result.reused ? 'Reusing existing job' : 'Job queued', 'success');
    logActivity(`${result.reused ? 'Reused' : 'Queued'} ${result.job_id}${selected ? ` (${selected.label})` : ''}`, 'success');
    pollJob(result.job_id);
    await refreshJobs();
  } catch (error) {
    toast(error.message, 'error');
    logActivity(`Download failed: ${error.message}`, 'failed');
  } finally {
    setLoading(els.downloadBtn, false);
  }
}

function pollJob(id) {
  if (state.pollers.has(id)) return;
  const interval = setInterval(async () => {
    try {
      const job = await request(`/status/${encodeURIComponent(id)}`);
      const idx = state.jobs.findIndex((j) => j.job_id === id);
      if (idx >= 0) state.jobs[idx] = job; else state.jobs.unshift(job);
      renderJobs();
      if (['ready', 'failed'].includes(job.status)) {
        clearInterval(interval);
        state.pollers.delete(id);
        if (job.status === 'ready') {
          toast(`Ready: ${job.file?.filename || id}`, 'success');
          logActivity(`Ready ${id}`, 'success');
        } else {
          logActivity(`Job ${id} failed: ${job.error || 'unknown'}`, 'failed');
        }
      }
    } catch (error) {
      clearInterval(interval);
      state.pollers.delete(id);
    }
  }, 1500);
  state.pollers.set(id, interval);
}

async function downloadFile(jobId, filename) {
  const response = await fetch(`/file/${encodeURIComponent(jobId)}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename || `${jobId}.bin`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

async function refreshHealth() {
  try {
    const data = await request('/health');
    setHealthState(data);
  } catch (error) {
    els.health.className = 'pill pill-status failed';
    els.health.querySelector('.label').textContent = 'Offline';
  }
}

async function refreshJobs() {
  try {
    const data = await request('/jobs?limit=50');
    state.jobs = data.jobs || [];
    renderJobs();
    state.jobs
      .filter((job) => ['queued', 'downloading', 'processing'].includes(job.status))
      .forEach((job) => pollJob(job.job_id));
  } catch (error) {
    els.jobs.innerHTML = `<p class="empty" style="color:var(--danger)">${escapeHtml(error.message)}</p>`;
  }
}

async function refresh() {
  await Promise.all([refreshHealth(), refreshJobs()]);
}

els.inspectBtn.addEventListener('click', inspect);
els.url.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') inspect();
});

els.pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      els.url.value = text.trim();
      inspect();
    }
  } catch {
    toast('Clipboard access denied', 'error');
  }
});

els.modeTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    state.mode = tab.dataset.mode;
    state.selected = (state.mode === 'audio' ? state.audioChoices : state.videoChoices).length ? 0 : null;
    syncModeTabs();
    renderChoices();
  });
});

els.qualityChoices.addEventListener('click', (event) => {
  const button = event.target.closest('[data-choice]');
  if (!button) return;
  state.selected = Number(button.dataset.choice);
  renderChoices();
});

els.downloadBtn.addEventListener('click', startDownload);

els.filters.forEach((button) => {
  button.addEventListener('click', () => {
    els.filters.forEach((b) => b.classList.remove('active'));
    button.classList.add('active');
    state.filter = button.dataset.filter || 'all';
    renderJobs();
  });
});

els.jobs.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-download]');
  if (!button) return;
  try {
    await downloadFile(button.dataset.download, button.dataset.filename);
    toast('Download started', 'success');
  } catch (error) {
    toast(error.message, 'error');
  }
});

els.refreshBtn.addEventListener('click', () => {
  logActivity('Manual refresh');
  refresh();
});

els.clearActivityBtn.addEventListener('click', () => {
  els.jobs.innerHTML = '';
});

refresh();
setInterval(refresh, 6000);
