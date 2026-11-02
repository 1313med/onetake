/**
 * Timed SFX under Remotion video (whoosh/hit/pop/riser/tick/stamp/click).
 * Dense CapCut-style bed: up to ~48 hits from plan.sfxEvents / effectBeats.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ffmpegPath } = require('../ffmpeg');

const SFX_DIR = path.join(__dirname, '..', '..', 'assets', 'sfx');

const SFX_MAP = {
  whoosh: 'whoosh.wav',
  hit: 'hit.wav',
  pop: 'pop.wav',
  riser: 'riser.wav',
  tick: 'tick.wav',
  stamp: 'stamp.wav',
  click: 'click.wav',
};

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => {
      err += d.toString();
    });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-700) || `ffmpeg ${code}`))));
  });
}

async function ensureSfxAssets() {
  fs.mkdirSync(SFX_DIR, { recursive: true });
  const specs = {
    whoosh: [
      'sine=frequency=380:sample_rate=44100:duration=0.28',
      'afade=t=in:st=0:d=0.04,afade=t=out:st=0.14:d=0.14,volume=0.42',
    ],
    hit: [
      'sine=frequency=85:sample_rate=44100:duration=0.16',
      'afade=t=out:st=0.04:d=0.12,volume=0.62',
    ],
    pop: [
      'sine=frequency=720:sample_rate=44100:duration=0.09',
      'afade=t=out:st=0.03:d=0.06,volume=0.38',
    ],
    riser: [
      'sine=frequency=200:sample_rate=44100:duration=0.45',
      'afade=t=in:st=0:d=0.3,afade=t=out:st=0.35:d=0.1,volume=0.32',
    ],
    tick: [
      'sine=frequency=1400:sample_rate=44100:duration=0.05',
      'afade=t=out:st=0.015:d=0.035,volume=0.28',
    ],
    stamp: [
      'sine=frequency=55:sample_rate=44100:duration=0.22',
      'afade=t=out:st=0.05:d=0.17,volume=0.7',
    ],
    click: [
      'sine=frequency=980:sample_rate=44100:duration=0.04',
      'afade=t=out:st=0.01:d=0.03,volume=0.22',
    ],
  };
  for (const [name, [lavfi, af]] of Object.entries(specs)) {
    const out = path.join(SFX_DIR, `${name}.wav`);
    // Regenerate if tiny / missing so new kinds always exist
    if (fs.existsSync(out) && fs.statSync(out).size > 400) continue;
    await runFfmpeg(['-y', '-f', 'lavfi', '-i', lavfi, '-af', af, out]);
  }
}

function resolveSfxPath(kind) {
  const key = SFX_MAP[kind] ? kind : 'whoosh';
  const full = path.join(SFX_DIR, SFX_MAP[key]);
  return fs.existsSync(full) ? full : null;
}

function collectSfxBeats(plan) {
  if (Array.isArray(plan?.sfxEvents) && plan.sfxEvents.length) {
    return plan.sfxEvents.slice(0, 48).map((e) => ({
      atSec: e.atSec,
      sfx: e.kind || e.sfx || 'pop',
    }));
  }
  return (plan.effectBeats || [])
    .filter((b) => b.sfx || b.effectId)
    .slice(0, 40)
    .map((b) => ({ atSec: b.atSec, sfx: b.sfx || 'whoosh' }));
}

/**
 * Mux music + timed effect SFX under a video that already has voice.
 */
async function muxMusicAndSfx(videoPath, musicPath, musicVol, plan, outPath) {
  await ensureSfxAssets();
  const beats = collectSfxBeats(plan);
  const durationSec = Math.min(180, (plan.totalDuration || 100) + 0.5);
  const hasMusic = musicPath && fs.existsSync(musicPath) && fs.statSync(musicPath).size > 1000;

  const inputs = ['-y', '-i', videoPath];
  let inputIdx = 1;
  let filter = `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=1.2,highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=20:release=200[voice];`;
  const mixLabels = ['[voice]'];

  if (hasMusic) {
    inputs.push('-stream_loop', '-1', '-i', musicPath);
    filter += `[${inputIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=${musicVol}[music];`;
    mixLabels.push('[music]');
    inputIdx += 1;
  }

  // FFmpeg amix input count can get heavy — batch if needed; 48 is fine on desktop
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const sfxPath = resolveSfxPath(beat.sfx || 'whoosh');
    if (!sfxPath) continue;
    const delayMs = Math.max(0, Math.round((beat.atSec || 0) * 1000));
    inputs.push('-i', sfxPath);
    const lab = `sfx${i}`;
    const vol =
      beat.sfx === 'stamp' || beat.sfx === 'hit'
        ? 0.7
        : beat.sfx === 'click' || beat.sfx === 'tick'
          ? 0.35
          : 0.55;
    filter += `[${inputIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=${vol},adelay=${delayMs}|${delayMs}[${lab}];`;
    mixLabels.push(`[${lab}]`);
    inputIdx += 1;
  }

  const n = mixLabels.length;
  filter += `${mixLabels.join('')}amix=inputs=${n}:duration=first:dropout_transition=2:normalize=0[a]`;

  await runFfmpeg([
    ...inputs,
    '-filter_complex',
    filter,
    '-map',
    '0:v',
    '-map',
    '[a]',
    '-t',
    String(durationSec),
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    outPath,
  ]);
}

module.exports = { ensureSfxAssets, muxMusicAndSfx, SFX_DIR, resolveSfxPath, collectSfxBeats };
