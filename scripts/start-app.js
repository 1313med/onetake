/**
 * Start Expo for a physical phone on the same Wi‑Fi.
 * - No tunnel (avoids websocket 409)
 * - Not --offline (keeps Expo account on the manifest so Expo Go matches CLI login)
 */
const os = require('os');
const { spawn } = require('child_process');
const path = require('path');

function lanIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal && String(net.address).startsWith('192.168.')) {
        return net.address;
      }
    }
  }
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

const ip = process.env.REACT_NATIVE_PACKAGER_HOSTNAME || lanIPv4();
process.env.REACT_NATIVE_PACKAGER_HOSTNAME = ip;
process.env.EXPO_NO_TELEMETRY = '1';

const port = process.env.EXPO_PORT || '8081';
const root = path.join(__dirname, '..');
const expoCli = path.join(root, 'node_modules', 'expo', 'bin', 'cli');

console.log('');
console.log('Expo LAN (no tunnel)');
console.log(`  CLI account:   run "npx expo whoami" if Expo Go complains`);
console.log(`  Packager host: ${ip}`);
console.log(`  Metro:         http://${ip}:${port}`);
console.log(`  Phone URL:     exp://${ip}:${port}`);
console.log(`  Studio API:    ${process.env.EXPO_PUBLIC_STUDIO_API || `http://${ip}:8787`}`);
console.log('');
console.log('Expo Go → Enter URL manually. Connection must NOT be Tunnel.');
console.log('Other terminal: npm run studio');
console.log('');

const child = spawn(
  process.execPath,
  [expoCli, 'start', '--lan', '--port', String(port), ...process.argv.slice(2)],
  {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  }
);

child.on('exit', (code) => process.exit(code || 0));
