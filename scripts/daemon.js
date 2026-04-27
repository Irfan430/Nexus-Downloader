#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const runtimeDir = path.join(root, '.runtime');
const pidFile = path.join(runtimeDir, 'media-downloader.pid');
const logFile = path.join(root, 'logs', 'daemon.log');

function readPid() {
  try {
    const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function isRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function ensureDirs() {
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
}

function start() {
  ensureDirs();
  const existing = readPid();
  if (isRunning(existing)) {
    console.log(`Daemon already running with PID ${existing}`);
    return;
  }

  const out = fs.openSync(logFile, 'a');
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: root,
    detached: true,
    env: process.env,
    stdio: ['ignore', out, out]
  });
  child.unref();
  fs.writeFileSync(pidFile, String(child.pid));
  console.log(`Daemon started with PID ${child.pid}`);
  console.log(`Logs: ${logFile}`);
}

function stop() {
  const pid = readPid();
  if (!pid || !isRunning(pid)) {
    fs.rmSync(pidFile, { force: true });
    console.log('Daemon is not running');
    return;
  }
  process.kill(pid, 'SIGTERM');
  fs.rmSync(pidFile, { force: true });
  console.log(`Daemon stopped: ${pid}`);
}

function status() {
  const pid = readPid();
  if (isRunning(pid)) {
    console.log(`Daemon running with PID ${pid}`);
    return;
  }
  console.log('Daemon is not running');
}

const command = process.argv[2] || 'status';
if (command === 'start') start();
else if (command === 'stop') stop();
else if (command === 'status') status();
else {
  console.error('Usage: node scripts/daemon.js <start|stop|status>');
  process.exit(1);
}
