const { spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const config = require('../config');

ffmpeg.setFfmpegPath(config.ffmpegPath);

async function isAvailable() {
  return new Promise((resolve) => {
    const child = spawn(config.ffmpegPath, ['-version'], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

function convert(input, output, options = {}) {
  return new Promise((resolve, reject) => {
    let command = ffmpeg(input).output(output);
    if (options.audioBitrate) command = command.audioBitrate(options.audioBitrate);
    if (options.format) command = command.format(options.format);
    command.on('end', () => resolve(output)).on('error', reject).run();
  });
}

module.exports = { convert, isAvailable };
