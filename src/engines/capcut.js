const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../config');
const { detectPlatform } = require('../utils/urlDetector');
const { buildDownloadPath, fileInfo } = require('../utils/fileHelper');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';

function browserHeaders(extra = {}) {
  return {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    ...extra
  };
}

async function resolveCanonicalUrl(rawUrl) {
  try {
    const response = await axios.get(rawUrl, {
      headers: browserHeaders(),
      maxRedirects: 10,
      timeout: 30000,
      validateStatus: () => true
    });
    const finalUrl = response.request?.res?.responseUrl || response.config?.url || rawUrl;
    return { finalUrl, html: typeof response.data === 'string' ? response.data : '' };
  } catch (error) {
    throw new Error(`CapCut redirect failed: ${error.message}`);
  }
}

function decodeEntities(value) {
  if (!value) return value;
  return value
    .replace(/\\u002F/gi, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003D/gi, '=')
    .replace(/\\u003F/gi, '?')
    .replace(/\\u0023/gi, '#')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

function findMatches(html, regex) {
  const out = new Set();
  let match;
  while ((match = regex.exec(html)) !== null) {
    out.add(decodeEntities(match[1] || match[0]));
  }
  return Array.from(out);
}

function parseMediaUrls(html) {
  if (!html) return { videos: [], thumbnails: [], title: null };
  const videos = findMatches(html, /https?:\\?\/\\?\/[A-Za-z0-9.-]*capcutvod\.com\\?\/[^"'\\)\s]+/g)
    .map((url) => url.replace(/\\u002F/gi, '/'))
    .filter((url, index, self) => self.indexOf(url) === index);
  const thumbnails = findMatches(html, /https?:\\?\/\\?\/[A-Za-z0-9.-]*ibyteimg\.com\\?\/[^"'\\)\s]+/g);
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  return {
    videos,
    thumbnails: ogImage ? [ogImage[1], ...thumbnails] : thumbnails,
    title: titleMatch ? titleMatch[1].trim() : null
  };
}

async function fetchPage(url) {
  const response = await axios.get(url, {
    headers: browserHeaders({ Referer: 'https://www.capcut.com/' }),
    timeout: 30000,
    maxRedirects: 10,
    responseType: 'text',
    transformResponse: (data) => data
  });
  return typeof response.data === 'string' ? response.data : '';
}

async function discoverMedia(rawUrl) {
  const { finalUrl, html } = await resolveCanonicalUrl(rawUrl);
  let candidates = parseMediaUrls(html);
  if (!candidates.videos.length && finalUrl !== rawUrl) {
    const refetched = await fetchPage(finalUrl);
    candidates = parseMediaUrls(refetched);
  }
  if (!candidates.videos.length) {
    const refetchOriginal = await fetchPage(rawUrl);
    candidates = parseMediaUrls(refetchOriginal);
  }
  if (!candidates.videos.length) {
    throw new Error('CapCut page did not expose a downloadable video URL');
  }
  return { finalUrl, ...candidates };
}

async function downloadStream(url, target, referer) {
  const response = await axios.get(url, {
    headers: browserHeaders({ Referer: referer || 'https://www.capcut.com/' }),
    responseType: 'stream',
    timeout: 0,
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });
  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(target);
    response.data.pipe(writeStream);
    response.data.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);
  });
}

const capcut = {
  name: 'capcut',

  async isAvailable() {
    try {
      await axios.get('https://www.capcut.com/', { timeout: 8000, headers: browserHeaders() });
      return true;
    } catch {
      return false;
    }
  },

  async info(url) {
    const { videos, thumbnails, title, finalUrl } = await discoverMedia(url);
    const formats = videos.map((src, index) => ({
      id: `capcut_${index}`,
      quality: index === 0 ? 'best' : `source_${index + 1}`,
      ext: 'mp4',
      filesize: null,
      width: null,
      height: null,
      fps: null,
      has_audio: true,
      has_video: true,
      url: src
    }));
    return {
      success: true,
      engine: 'capcut',
      platform: 'capcut',
      title: (title || '').replace(/\s*\|.*$/, '').trim() || 'CapCut Template',
      thumbnail: thumbnails[0] || null,
      duration: null,
      uploader: 'CapCut',
      view_count: null,
      formats,
      audio_formats: [],
      canonical_url: finalUrl
    };
  },

  async download(url, options = {}) {
    const { videos, finalUrl } = await discoverMedia(url);
    const ext = options.audio_only ? (options.format || 'mp3') : (options.format || 'mp4');
    const target = buildDownloadPath(options.jobId, options.audio_only ? 'mp4' : ext);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const sourceUrl = videos[0];
    await downloadStream(sourceUrl, target, finalUrl);

    if (options.audio_only) {
      const { runCommand } = require('./process');
      const audioTarget = buildDownloadPath(options.jobId, ext);
      try {
        await runCommand(config.ffmpegPath, ['-y', '-i', target, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', audioTarget], {
          timeoutMs: 1000 * 60 * 10
        });
        fs.rmSync(target, { force: true });
        return {
          success: true,
          engine: 'capcut',
          platform: 'capcut',
          file: fileInfo(audioTarget)
        };
      } catch (error) {
        return {
          success: true,
          engine: 'capcut',
          platform: 'capcut',
          file: fileInfo(target)
        };
      }
    }

    return {
      success: true,
      engine: 'capcut',
      platform: 'capcut',
      file: fileInfo(target)
    };
  }
};

module.exports = capcut;
