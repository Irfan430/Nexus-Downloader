const { downloadFingerprint } = require('../utils/urlDetector');

const MAX_VIDEO_CHOICES = 5;

function numericQuality(value) {
  const match = String(value || '').match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

function videoLabel(format) {
  if (format.quality && format.quality !== 'unknown') return format.quality;
  if (format.height) return `${format.height}p`;
  return 'Video';
}

function audioLabel(format) {
  if (format.quality) return `Audio ${format.quality}`;
  return 'Audio';
}

function addChoice(choices, seen, choice) {
  const key = `${choice.type}:${choice.label.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  choices.push(choice);
}

function fromFormat(format) {
  const quality = videoLabel(format);
  return {
    type: 'video',
    label: quality,
    description: [format.ext, formatBytes(format.filesize)].filter(Boolean).join(' · '),
    options: {
      quality,
      format: format.ext === 'webm' ? 'webm' : 'mp4',
      format_id: format.has_audio ? format.id : undefined,
      no_watermark: true
    },
    rank: format.height || numericQuality(quality)
  };
}

function fromLink(link) {
  const quality = videoLabel(link);
  return {
    type: 'video',
    label: quality,
    description: 'video',
    options: {
      quality,
      format: 'mp4',
      no_watermark: true
    },
    rank: link.height || numericQuality(quality)
  };
}

function audioChoice(formatOrLink) {
  const quality = formatOrLink.quality || '320k';
  return {
    type: 'audio',
    label: audioLabel(formatOrLink),
    description: formatOrLink.ext || 'audio',
    options: {
      audio_only: true,
      quality,
      format: formatOrLink.ext === 'm4a' ? 'm4a' : 'mp3',
      format_id: formatOrLink.id,
      no_watermark: true
    },
    rank: numericQuality(quality)
  };
}

function buildQualityChoices(result = {}) {
  const videoChoices = [];
  const audioChoices = [];
  const seenVideo = new Set();
  const seenAudio = new Set();
  const formats = Array.isArray(result.formats) ? result.formats : [];
  const audioFormats = [
    ...formats.filter((format) => format.has_audio && !format.has_video),
    ...(Array.isArray(result.audio_formats) ? result.audio_formats : [])
  ];

  formats
    .filter((format) => format.has_video)
    .sort((a, b) => (b.height || numericQuality(b.quality)) - (a.height || numericQuality(a.quality)))
    .forEach((format) => addChoice(videoChoices, seenVideo, fromFormat(format)));

  for (const link of [result.links?.high, result.links?.low].filter(Boolean)) {
    addChoice(videoChoices, seenVideo, fromLink(link));
  }

  audioFormats
    .sort((a, b) => numericQuality(b.quality) - numericQuality(a.quality))
    .forEach((format) => addChoice(audioChoices, seenAudio, audioChoice(format)));

  if (result.links?.audio) addChoice(audioChoices, seenAudio, audioChoice(result.links.audio));

  return [
    ...videoChoices.slice(0, MAX_VIDEO_CHOICES),
    ...audioChoices.slice(0, 2)
  ].map(({ rank, ...choice }) => choice);
}

function buildSelectionKeyboard(sessionId, choices) {
  return {
    inline_keyboard: choices.map((choice, index) => ([{
      text: choice.label,
      callback_data: `dl:${sessionId}:${index}`
    }]))
  };
}

function deliveryKey(chatId, url, options = {}) {
  return `${chatId}:${downloadFingerprint(url, options)}`;
}

function createDeliveryGuard() {
  const active = new Set();
  const completed = new Set();

  return {
    begin(key) {
      if (active.has(key) || completed.has(key)) return false;
      active.add(key);
      return true;
    },
    complete(key) {
      active.delete(key);
      completed.add(key);
    },
    release(key) {
      active.delete(key);
    },
    has(key) {
      return active.has(key) || completed.has(key);
    }
  };
}

module.exports = {
  buildQualityChoices,
  buildSelectionKeyboard,
  createDeliveryGuard,
  deliveryKey,
  formatBytes
};
