/**
 * Start the OneTake studio API. Keeps process alive and fails clearly on port clash.
 */
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 8787);

function canBind(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '0.0.0.0');
  });
}

(async () => {
  const free = await canBind(PORT);
  if (!free) {
    console.error(`Port ${PORT} is already in use.`);
    console.error('Studio may already be running. Check: curl http://127.0.0.1:8787/health');
    console.error('Or kill the old process, then retry.');
    process.exit(1);
  }

  const root = path.join(__dirname, '..');
  const child = spawn(process.execPath, [path.join(root, 'server', 'index.js')], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`Studio exited from signal ${signal}`);
    }
    process.exit(code || 0);
  });
})();
