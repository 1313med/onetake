const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ffmpegPath, probe } = require('../ffmpeg');
const { writeAssFile, overlayEventsFromTimeline } = require('./ass');
const { gradeFilter, cameraFilterForClip } = require('./camera');

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => {
      err += d.toString();
    });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-900) || `ffmpeg ${code}`))));
  });
}

function poolLimit(items, limit, worker) {
  const ret = new Array(items.length);
  let i = 0;
  async function next() {
    const idx = i++;
    if (idx >= items.length) return;
    ret[idx] = await worker(items[idx], idx);
    return next();
  }
  const n = Math.max(1, Math.min(limit, items.length));
  return Promise.all(Array.from({ length: n }, () => next())).then(() => ret);
}

function remotionEnabled(plan) {
  if (process.env.REMOTION_ENABLED === '0') return false;
  if (process.env.REMOTION_ENABLED === '1') return true;
  return Array.isArray(plan?.effectBeats) && plan.effectBeats.length > 0;
}

async function muxMusicUnder(videoPath, musicPath, musicVol, durationSec, outPath) {
  const hasMusic = musicPath && fs.existsSync(musicPath) && fs.statSync(musicPath).size > 1000;
  if (!hasMusic) {
    if (videoPath !== outPath) fs.copyFileSync(videoPath, outPath);
    return;
  }
  await runFfmpeg([
    '-y',
    '-i',
    videoPath,
    '-stream_loop',
    '-1',
    '-i',
    musicPath,
    '-filter_complex',
    `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=1.2,highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=20:release=200[voice];` +
      `[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=${musicVol}[music];` +
      `[voice][music]amix=inputs=2:duration=first:dropout_transition=2[a]`,
    '-map',
    '0:v',
    '-map',
    '[a]',
    '-t',
    String(Math.min(180, durationSec + 0.5)),
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

/**
 * Remotion path: React UGC compositions + effectBeats. FFmpeg only for music mux.
 */
async function renderEdlRemotion(jobDir, sourcePath, plan, musicPath, onProgress) {
  const { renderUgCVariant } = require('../../remotion/render');
  const work = path.join(jobDir, `work_${plan.id}`);
  fs.mkdirSync(work, { recursive: true });
  const remotionOut = path.join(work, 'remotion_plate.mp4');
  const outPath = path.join(jobDir, `version_${plan.index}_${plan.id}.mp4`);

  onProgress?.(0.05, 'Remotion UGC effects');
  await renderUgCVariant({
    sourcePath,
    plan,
    outPath: remotionOut,
    onProgress: (p, msg) => onProgress?.(0.05 + p * 0.75, msg),
  });

  const musicVol = Math.max(
    0.18,
    (plan.music && typeof plan.music === 'object' ? plan.music.musicVol : null) ?? plan.musicVol ?? 0.24
  );
  onProgress?.(0.85, 'Mux music + SFX');
  try {
    const { muxMusicAndSfx } = require('./sfx');
    await muxMusicAndSfx(remotionOut, musicPath, musicVol, plan, outPath);
  } catch (err) {
    console.warn('[render] SFX mux failed, music-only:', err?.message || err);
    await muxMusicUnder(remotionOut, musicPath, musicVol, plan.totalDuration || 100, outPath);
  }

  onProgress?.(0.95, 'Probing output');
  const meta = await probe(outPath);
  return {
    path: outPath,
    fileName: path.basename(outPath),
    duration: Number(meta.format.duration || 0),
    size: fs.statSync(outPath).size,
    width: 1080,
    height: 1920,
    engine: 'remotion',
  };
}

/**
 * Legacy FFmpeg + ASS path (fallback when Remotion disabled / unavailable).
 */
async function renderEdlFfmpeg(jobDir, sourcePath, plan, musicPath, onProgress) {
  const work = path.join(jobDir, `work_${plan.id}`);
  fs.mkdirSync(work, { recursive: true });

  const emphasize = (plan.timeline || []).flatMap((c) => c.captions?.emphasize || []);
  const assPath = path.join(work, 'captions.ass');
  const overlays = overlayEventsFromTimeline(plan.timeline || []);
  writeAssFile(plan.captions || [], plan.captionStyle, assPath, emphasize, overlays);

  const clipFiles = [];
  for (let i = 0; i < plan.timeline.length; i++) {
    const clip = plan.timeline[i];
    const outClip = path.join(work, `clip_${String(i).padStart(3, '0')}.mp4`);
    const dur = Math.max(0.2, clip.srcEnd - clip.srcStart);
    onProgress?.(0.05 + (0.4 * i) / plan.timeline.length, `Cutting clip ${i + 1}/${plan.timeline.length}`);

    const cam = cameraFilterForClip(clip);
    await runFfmpeg([
      '-y',
      '-ss',
      String(clip.srcStart),
      '-t',
      String(dur),
      '-i',
      sourcePath,
      '-vf',
      `${cam},setsar=1`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-movflags',
      '+faststart',
      outClip,
    ]);
    clipFiles.push({ file: outClip, clip });
  }

  onProgress?.(0.5, 'Joining takes');
  const concatPath = path.join(work, 'concat.mp4');
  if (clipFiles.length === 1) {
    fs.copyFileSync(clipFiles[0].file, concatPath);
  } else {
    const wantsXfade = plan.timeline.some((c, idx) => idx > 0 && c.transitionIn?.type === 'xfade');
    if (wantsXfade && clipFiles.length <= 6) {
      await xfadeJoin(clipFiles, concatPath);
    } else {
      const listPath = path.join(work, 'concat.txt');
      fs.writeFileSync(
        listPath,
        clipFiles.map((f) => `file '${f.file.replace(/\\/g, '/')}'`).join('\n'),
        'utf8'
      );
      await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', concatPath]);
    }
  }

  const outPath = path.join(jobDir, `version_${plan.index}_${plan.id}.mp4`);
  const assEscaped = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  const grade = gradeFilter(plan.grade);
  const vf = `${grade},ass='${assEscaped}'`;
  onProgress?.(0.7, 'Grading, captions, audio mix');

  const musicVol = Math.max(
    0.18,
    (plan.music && typeof plan.music === 'object' ? plan.music.musicVol : null) ?? plan.musicVol ?? 0.24
  );
  const hasMusic = musicPath && fs.existsSync(musicPath) && fs.statSync(musicPath).size > 1000;
  if (!hasMusic) {
    console.warn(`[render] missing music bed for ${plan.id}: ${musicPath || '(none)'}`);
  }

  if (hasMusic) {
    await runFfmpeg([
      '-y',
      '-i',
      concatPath,
      '-stream_loop',
      '-1',
      '-i',
      musicPath,
      '-filter_complex',
      `[0:v]${vf}[v];` +
        `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=1.25,highpass=f=80,lowpass=f=12000,acompressor=threshold=-18dB:ratio=3:attack=20:release=200[voice];` +
        `[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=${musicVol}[music];` +
        `[voice][music]amix=inputs=2:duration=first:dropout_transition=2[a]`,
      '-map',
      '[v]',
      '-map',
      '[a]',
      '-t',
      String(Math.min(180, (plan.totalDuration || 100) + 0.5)),
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '19',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      outPath,
    ]);
  } else {
    await runFfmpeg([
      '-y',
      '-i',
      concatPath,
      '-vf',
      vf,
      '-af',
      'volume=1.2,highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=20:release=200',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '19',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      outPath,
    ]);
  }

  onProgress?.(0.95, 'Probing output');
  const meta = await probe(outPath);
  return {
    path: outPath,
    fileName: path.basename(outPath),
    duration: Number(meta.format.duration || 0),
    size: fs.statSync(outPath).size,
    width: 1080,
    height: 1920,
    engine: 'ffmpeg_ass',
  };
}

/**
 * Execute one EDL — Remotion UGC effects when effectBeats present; FFmpeg ASS fallback.
 */
async function renderEdl(jobDir, sourcePath, plan, musicPath, onProgress) {
  if (remotionEnabled(plan)) {
    try {
      return await renderEdlRemotion(jobDir, sourcePath, plan, musicPath, onProgress);
    } catch (err) {
      console.error(`[render] Remotion failed for ${plan.id}, falling back to FFmpeg ASS:`, err?.message || err);
      onProgress?.(0.02, 'Remotion failed — FFmpeg fallback');
      return renderEdlFfmpeg(jobDir, sourcePath, plan, musicPath, onProgress);
    }
  }
  return renderEdlFfmpeg(jobDir, sourcePath, plan, musicPath, onProgress);
}

async function xfadeJoin(clipFiles, outPath) {
  const inputs = [];
  clipFiles.forEach((c) => inputs.push('-i', c.file));
  let filter = '';
  let prev = '[0:v]';
  let prevA = '[0:a]';
  let offset = 0;
  for (let i = 1; i < clipFiles.length; i++) {
    const dur = Math.max(0.2, clipFiles[i - 1].clip.srcEnd - clipFiles[i - 1].clip.srcStart);
    offset += Math.max(0.05, dur - 0.2);
    const vOut = i === clipFiles.length - 1 ? '[vout]' : `[v${i}]`;
    const aOut = i === clipFiles.length - 1 ? '[aout]' : `[a${i}]`;
    filter += `${prev}[${i}:v]xfade=transition=fade:duration=0.2:offset=${offset.toFixed(3)}${vOut};`;
    filter += `${prevA}[${i}:a]acrossfade=d=0.2${aOut};`;
    prev = vOut;
    prevA = aOut;
  }
  await runFfmpeg([
    '-y',
    ...inputs,
    '-filter_complex',
    filter,
    '-map',
    '[vout]',
    '-map',
    '[aout]',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-c:a',
    'aac',
    outPath,
  ]);
}

async function renderAllParallel(jobDir, sourcePath, plans, musicDir, onUpdate, concurrency) {
  // Remotion Chromium is heavy — default concurrency 1 unless overridden
  const remotionHeavy = (plans || []).some((p) => remotionEnabled(p));
  const limit =
    concurrency ||
    (remotionHeavy
      ? Math.max(1, Number(process.env.REMOTION_CONCURRENCY || 1))
      : Math.max(1, Math.min(3, Math.floor(require('os').cpus().length / 2) || 1)));
  return poolLimit(plans, limit, async (plan, idx) => {
    const musicPath = path.join(musicDir, typeof plan.music === 'string' ? plan.music : plan.music?.bed || plan.music);
    onUpdate?.(plan, idx, 0, `Rendering ${plan.name}…`);
    const rendered = await renderEdl(jobDir, sourcePath, plan, musicPath, (p, msg) => {
      onUpdate?.(plan, idx, p, msg);
    });
    return { plan, rendered };
  });
}

module.exports = { renderEdl, renderAllParallel, poolLimit, remotionEnabled };
