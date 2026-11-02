const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ffmpegPath } = require('./ffmpeg');
const { extractAudio } = require('./analyze');
const { canReuseWav, canReuseProxy } = require('./artifactCache');

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => {
      err += d.toString();
    });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-800) || `ffmpeg ${code}`))));
  });
}

/**
 * Prepare reusable media: 16k mono WAV + vertical proxy for faster edits.
 */
async function prepareMedia(jobDir, sourcePath, onProgress) {
  const wav = path.join(jobDir, 'audio.wav');
  const proxy = path.join(jobDir, 'proxy.mp4');
  const result = { wav, proxy, reusedWav: false, reusedProxy: false };

  if (canReuseWav(jobDir)) {
    result.reusedWav = true;
    onProgress?.('Reusing extracted audio…');
  } else {
    onProgress?.('Extracting audio for transcription…');
    await extractAudio(sourcePath, wav);
  }

  if (process.env.SKIP_PROXY === '1' || process.env.SKIP_PROXY === 'true') {
    onProgress?.('Skipping edit proxy (using source)…');
    result.proxy = null;
  } else if (canReuseProxy(jobDir)) {
    result.reusedProxy = true;
    onProgress?.('Reusing edit proxy…');
  } else {
    onProgress?.('Building 720p edit proxy…');
    // Write without +faststart so progress is visible on disk; remux is costly on long takes.
    await runFfmpeg([
      '-y',
      '-i',
      sourcePath,
      '-vf',
      'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-crf',
      '26',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      proxy,
    ]);
  }

  if (!fs.existsSync(wav) || fs.statSync(wav).size < 1000) {
    throw new Error('Audio extraction failed — no usable WAV.');
  }

  return result;
}

module.exports = { prepareMedia };
