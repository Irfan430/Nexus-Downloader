const path = require('path');
const fs = require('fs');
const { runCommand } = require('./process');
const config = require('../config');
const { detectPlatform } = require('../utils/urlDetector');
const { buildDownloadPath, fileInfo, findJobFile } = require('../utils/fileHelper');

function parseInfo(json) {
  const data = JSON.parse(json);
  const formats = (data.formats || [])
    .filter((format) => format.format_id)
    .map((format) => ({
      id: format.format_id,
      quality: format.height ? `${format.height}p` : (format.format_note || format.resolution || 'unknown'),
      ext: format.ext,
      filesize: format.filesize || format.filesize_approx || null,
      width: format.width || null,
      height: format.height || null,
      fps: format.fps || null,
      has_audio: Boolean(format.acodec && format.acodec !== 'none'),
      has_video: Boolean((format.vcodec && format.vcodec !== 'none') || ['mp4', 'webm', 'mov'].includes(format.ext))
    }));

  const audioFormats = (data.formats || [])
    .filter((format) => format.acodec && format.acodec !== 'none' && (!format.vcodec || format.vcodec === 'none'))
    .map((format) => ({
      id: format.format_id,
      quality: format.abr ? `${format.abr}k` : (format.format_note || 'audio'),
      ext: format.ext,
      has_audio: true,
      has_video: false
    }));

  return {
    success: true,
    engine: 'ytdlp',
    platform: detectPlatform(data.webpage_url || data.original_url || ''),
    title: data.title || null,
    thumbnail: data.thumbnail || null,
    duration: data.duration || null,
    uploader: data.uploader || data.channel || null,
    view_count: data.view_count || null,
    formats,
    audio_formats: audioFormats
  };
}

const ytdlp = {
  name: 'ytdlp',

  async isAvailable() {
    try {
      await runCommand('yt-dlp', ['--version'], { timeoutMs: 10000 });
      return true;
    } catch {
      return false;
    }
  },

  async info(url) {
    const { stdout } = await runCommand('yt-dlp', ['--dump-single-json', '--no-warnings', '--skip-download', url], {
      timeoutMs: 90000
    });
    return parseInfo(stdout);
  },

  async download(url, options = {}) {
    const ext = options.audio_only ? (options.format || 'mp3') : (options.format || 'mp4');
    const target = buildDownloadPath(options.jobId, ext);
    const outputTemplate = path.join(path.dirname(target), `${path.basename(target, path.extname(target))}.%(ext)s`);
    const args = [
      '--newline',
      '--restrict-filenames',
      '--concurrent-fragments',
      String(config.downloadConcurrency || 8),
      '--retries',
      '10',
      '--fragment-retries',
      '10',
      '-o',
      outputTemplate
    ];
    const ffmpegAvailable = fs.existsSync(config.ffmpegPath);
    const aria2Available = fs.existsSync(config.aria2Path);
    if (aria2Available) {
      args.push('--downloader', config.aria2Path);
      args.push('--downloader-args', `aria2c:-x ${config.downloadConcurrency} -s ${config.downloadConcurrency} -k 1M`);
    }

    if (options.audio_only) {
      if (options.format_id) args.push('-f', options.format_id);
      args.push('-x', '--audio-format', ext, '--audio-quality', options.quality || '0');
    } else if (options.format_id) {
      args.push('-f', options.format_id);
    } else if (!ffmpegAvailable) {
      args.push('-f', `best[height<=${String(options.quality || '720p').replace(/\D/g, '') || '720'}]/best`);
    } else {
      args.push('-f', `bestvideo[height<=${String(options.quality || '720p').replace(/\D/g, '') || '720'}]+bestaudio/best`);
      args.push('--merge-output-format', ext);
    }

    args.push(url);
    await runCommand('yt-dlp', args, { timeoutMs: 1000 * 60 * 30 });

    let resolved = fileInfo(target)
      || fileInfo(target.replace(/\.[^.]+$/, '.mp4'))
      || fileInfo(target.replace(/\.[^.]+$/, '.webm'))
      || findJobFile(options.jobId);

    if (resolved && !options.audio_only && /\.(unknown_video|unknown|mhtml|part)$/i.test(resolved.path)) {
      const remuxedTarget = buildDownloadPath(options.jobId, ext);
      try {
        await runCommand(config.ffmpegPath, ['-y', '-i', resolved.path, '-c', 'copy', remuxedTarget], {
          timeoutMs: 1000 * 60 * 10
        });
        fs.rmSync(resolved.path, { force: true });
        resolved = fileInfo(remuxedTarget) || resolved;
      } catch {
        const renamed = remuxedTarget;
        try {
          fs.renameSync(resolved.path, renamed);
          resolved = fileInfo(renamed) || resolved;
        } catch {}
      }
    }

    return {
      success: true,
      engine: 'ytdlp',
      platform: detectPlatform(url),
      file: resolved
    };
  }
};

module.exports = ytdlp;
