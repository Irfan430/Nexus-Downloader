const axios = require('axios');
const config = require('../config');
const { detectPlatform } = require('../utils/urlDetector');

function headers() {
  const h = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (config.cobaltApiKey) h.Authorization = `Api-Key ${config.cobaltApiKey}`;
  return h;
}

const cobalt = {
  name: 'cobalt',

  async isAvailable() {
    try {
      await axios.get(config.cobaltApiUrl, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  },

  async info(url) {
    throw new Error(`Cobalt does not provide metadata info for ${detectPlatform(url)}`);
  },

  async download(url, options = {}) {
    const response = await axios.post(`${config.cobaltApiUrl.replace(/\/$/, '')}/api/json`, {
      url,
      vQuality: options.quality || '720',
      filenameStyle: 'basic',
      isAudioOnly: Boolean(options.audio_only),
      isTTFullAudio: false,
      disableMetadata: !options.embed_metadata,
      twitterGif: true
    }, { headers: headers(), timeout: 45000 });

    const data = response.data || {};
    if (data.status === 'error') {
      throw new Error(data.text || 'Cobalt rejected the download');
    }

    if (data.url || data.picker) {
      return {
        success: true,
        engine: 'cobalt',
        platform: detectPlatform(url),
        remote_url: data.url || null,
        picker: data.picker || null,
        title: data.filename || null
      };
    }

    throw new Error('Cobalt response did not include a downloadable URL');
  }
};

module.exports = cobalt;
