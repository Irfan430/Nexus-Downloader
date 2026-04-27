const { runCommand } = require('../engines/process');
const { attachErrorMetadata } = require('../utils/errors');
const { detectPlatform, validateHttpUrl } = require('../utils/urlDetector');

function formatQuality(format) {
  if (format.height) return `${format.height}p`;
  if (format.abr) return `${format.abr}k`;
  return format.format_note || format.resolution || 'unknown';
}

function toPublicFormat(format) {
  return {
    id: format.format_id,
    quality: formatQuality(format),
    ext: format.ext || null,
    filesize: format.filesize || format.filesize_approx || null,
    width: format.width || null,
    height: format.height || null,
    fps: format.fps || null,
    has_audio: Boolean(format.acodec && format.acodec !== 'none'),
    has_video: Boolean((format.vcodec && format.vcodec !== 'none') || ['mp4', 'webm', 'mov'].includes(format.ext)),
    url: format.url || null
  };
}

function sortByVideoQuality(a, b) {
  const heightDelta = (a.height || 0) - (b.height || 0);
  if (heightDelta !== 0) return heightDelta;
  return (a.filesize || a.filesize_approx || 0) - (b.filesize || b.filesize_approx || 0);
}

function sortByAudioQuality(a, b) {
  return (a.abr || 0) - (b.abr || 0);
}

function pickLinks(formats) {
  const directFormats = formats.filter((format) => format.url);
  const videoFormats = directFormats
    .filter((format) => format.vcodec && format.vcodec !== 'none')
    .sort(sortByVideoQuality);
  const audioFormats = directFormats
    .filter((format) => format.acodec && format.acodec !== 'none' && (!format.vcodec || format.vcodec === 'none'))
    .sort(sortByAudioQuality);

  const low = videoFormats[0] ? toPublicFormat(videoFormats[0]) : null;
  const high = videoFormats[videoFormats.length - 1] ? toPublicFormat(videoFormats[videoFormats.length - 1]) : low;
  const audio = audioFormats[audioFormats.length - 1] ? toPublicFormat(audioFormats[audioFormats.length - 1]) : null;

  return { low, high, audio };
}

function normalizeYtdlpInfo(data, platform = null) {
  const formats = Array.isArray(data.formats) ? data.formats : [];
  const links = pickLinks(formats);
  const publicFormats = formats
    .filter((format) => format.format_id)
    .map(toPublicFormat);

  return {
    success: true,
    platform: platform || detectPlatform(data.webpage_url || data.original_url || data.url || ''),
    engine: 'ytdlp',
    title: data.title || null,
    thumbnail: data.thumbnail || null,
    duration: data.duration || null,
    uploader: data.uploader || data.channel || data.creator || null,
    view_count: data.view_count || null,
    webpage_url: data.webpage_url || data.original_url || null,
    links,
    formats: publicFormats,
    download_required: !links.low && !links.high && !links.audio
  };
}

async function resolveUrl(url) {
  if (!validateHttpUrl(url)) {
    const error = new Error('A valid http(s) URL is required');
    error.statusCode = 400;
    throw error;
  }

  let stdout;
  try {
    const result = await runCommand('yt-dlp', [
      '--dump-single-json',
      '--no-warnings',
      '--skip-download',
      url
    ], { timeoutMs: 90000, maxBuffer: 1024 * 1024 * 25 });
    stdout = result.stdout;
  } catch (error) {
    throw attachErrorMetadata(error);
  }

  return normalizeYtdlpInfo(JSON.parse(stdout), detectPlatform(url));
}

module.exports = {
  normalizeYtdlpInfo,
  resolveUrl
};
