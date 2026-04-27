const COBALT_SITES = [
  'youtube.com', 'youtu.be', 'm.youtube.com', 'www.youtube.com',
  'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com',
  'instagram.com', 'www.instagram.com',
  'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com', 't.co',
  'facebook.com', 'www.facebook.com', 'fb.watch',
  'vimeo.com', 'www.vimeo.com',
  'soundcloud.com', 'www.soundcloud.com',
  'twitch.tv', 'www.twitch.tv',
  'dailymotion.com', 'www.dailymotion.com',
  'capcut.com', 'www.capcut.com',
  'pinterest.com', 'www.pinterest.com',
  'snapchat.com', 'www.snapchat.com',
  'bilibili.com', 'www.bilibili.com'
];

const GALLERY_SITES = [
  'reddit.com', 'www.reddit.com', 'redd.it',
  'pixiv.net', 'www.pixiv.net',
  'deviantart.com', 'www.deviantart.com',
  'imgur.com', 'www.imgur.com',
  'flickr.com', 'www.flickr.com',
  'tumblr.com', 'www.tumblr.com',
  'danbooru.donmai.us',
  'gelbooru.com', 'www.gelbooru.com',
  'webtoons.com', 'www.webtoons.com'
];

function extractDomain(rawUrl) {
  const parsed = new URL(rawUrl);
  return parsed.hostname.toLowerCase().replace(/^www\./, '');
}

function detectPlatform(rawUrl) {
  const domain = extractDomain(rawUrl);
  if (domain.includes('youtube') || domain === 'youtu.be') return 'youtube';
  if (domain.includes('tiktok')) return 'tiktok';
  if (domain.includes('instagram')) return 'instagram';
  if (domain === 'x.com' || domain.includes('twitter')) return 'twitter';
  if (domain.includes('facebook') || domain === 'fb.watch') return 'facebook';
  if (domain.includes('reddit') || domain === 'redd.it') return 'reddit';
  if (domain.includes('pinterest')) return 'pinterest';
  if (domain.includes('soundcloud')) return 'soundcloud';
  if (domain.includes('vimeo')) return 'vimeo';
  if (domain.includes('twitch')) return 'twitch';
  if (domain.includes('capcut')) return 'capcut';
  if (domain.includes('imgur')) return 'imgur';
  return domain.split('.').slice(-2).join('.');
}

function validateHttpUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'igsh',
  'igshid',
  'mibextid',
  'si',
  'spm',
  's',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term'
]);

function canonicalizeUrl(rawUrl) {
  const parsed = new URL(String(rawUrl || '').trim());
  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

  for (const key of Array.from(parsed.searchParams.keys())) {
    if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
      parsed.searchParams.delete(key);
    }
  }

  const sorted = Array.from(parsed.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
  parsed.search = '';
  for (const [key, value] of sorted) parsed.searchParams.append(key, value);

  return parsed.toString();
}

function normalizedDownloadOptions(options = {}) {
  return {
    audio_only: Boolean(options.audio_only),
    format: String(options.format || (options.audio_only ? 'mp3' : 'mp4')).toLowerCase(),
    format_id: options.format_id || '',
    no_watermark: options.no_watermark !== false,
    quality: String(options.quality || (options.audio_only ? '320k' : '720p')).toLowerCase()
  };
}

function downloadFingerprint(rawUrl, options = {}) {
  const payload = JSON.stringify({
    url: canonicalizeUrl(rawUrl),
    options: normalizedDownloadOptions(options)
  });
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 24);
}

function enginePreference(rawUrl) {
  const domain = extractDomain(rawUrl);
  if (domain.includes('capcut')) return ['capcut', 'ytdlp', 'cobalt', 'puppeteer'];
  if (COBALT_SITES.includes(domain)) return ['cobalt', 'ytdlp', 'puppeteer'];
  if (GALLERY_SITES.includes(domain)) return ['gallerydl', 'ytdlp', 'puppeteer'];
  return ['ytdlp', 'cobalt', 'puppeteer'];
}

module.exports = {
  COBALT_SITES,
  GALLERY_SITES,
  detectPlatform,
  canonicalizeUrl,
  downloadFingerprint,
  enginePreference,
  extractDomain,
  normalizedDownloadOptions,
  validateHttpUrl
};
const crypto = require('crypto');
