const { spawn } = require('child_process');

function runCommand(command, args, options = {}) {
  const timeoutMs = options.timeoutMs || 120000;
  const maxBuffer = options.maxBuffer || 1024 * 1024 * 10;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > maxBuffer) child.kill('SIGTERM');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > maxBuffer) child.kill('SIGTERM');
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve({ stdout, stderr, code });
      reject(new Error(`${command} exited with ${code}: ${stderr || stdout}`));
    });
  });
}

module.exports = { runCommand };
