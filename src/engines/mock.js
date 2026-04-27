const { detectPlatform } = require('../utils/urlDetector');
const { fileInfo, writeMockMediaFile } = require('../utils/fileHelper');

const mock = {
  name: 'mock',

  async isAvailable() {
    return true;
  },

  async info(url) {
    return {
      success: true,
      engine: 'mock',
      platform: detectPlatform(url),
      title: `Mock media for ${detectPlatform(url)}`,
      thumbnail: null,
      duration: 42,
      uploader: 'local-test',
      view_count: 0,
      formats: [
        { id: 'mock-1080', quality: '1080p', ext: 'mp4', filesize: 1024, height: 1080, has_video: true, has_audio: true },
        { id: 'mock-720', quality: '720p', ext: 'mp4', filesize: 768, height: 720, has_video: true, has_audio: true }
      ],
      audio_formats: [
        { id: 'mock-mp3', quality: '128k', ext: 'mp3', has_video: false, has_audio: true }
      ]
    };
  },

  async download(url, options = {}) {
    const jobId = options.jobId || 'mock';
    const ext = options.audio_only ? (options.format || 'mp3') : (options.format || 'mp4');
    const filePath = writeMockMediaFile(jobId, ext, url);
    return {
      success: true,
      engine: 'mock',
      platform: detectPlatform(url),
      file: fileInfo(filePath),
      title: `Mock media for ${detectPlatform(url)}`
    };
  }
};

module.exports = mock;
