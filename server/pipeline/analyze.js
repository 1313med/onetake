const { spawn } = require('child_process');
const { probe, ffmpegPath } = require('./ffmpeg');

async function extractAudio(sourcePath, wavPath) {
  await new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', sourcePath,
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'pcm_s16le',
      wavPath,
    ];
    const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-800)))));
  });
  return wavPath;
}

async function analyzeSource(sourcePath) {
  const meta = await probe(sourcePath);
  const videoStream = meta.streams.find((s) => s.codec_type === 'video');
  const audioStream = meta.streams.find((s) => s.codec_type === 'audio');
  const duration = Number(meta.format.duration || 0);

  return {
    duration,
    width: videoStream?.width || 1080,
    height: videoStream?.height || 1920,
    fps: evalFraction(videoStream?.r_frame_rate) || 30,
    hasAudio: Boolean(audioStream),
    format: meta.format.format_name,
  };
}

function evalFraction(rate) {
  if (!rate) return 30;
  if (rate.includes('/')) {
    const [a, b] = rate.split('/').map(Number);
    return b ? a / b : 30;
  }
  return Number(rate) || 30;
}

module.exports = { analyzeSource, extractAudio };
