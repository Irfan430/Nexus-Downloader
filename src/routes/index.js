const info = require('./info');
const download = require('./download');
const status = require('./status');
const formats = require('./formats');
const audio = require('./audio');
const file = require('./file');
const batch = require('./batch');
const health = require('./health');
const resolve = require('./resolve');
const jobs = require('./jobs');
const dashboard = require('./dashboard');

module.exports = [
  health,
  dashboard,
  resolve,
  info,
  download,
  status,
  jobs,
  formats,
  audio,
  file,
  batch
];
