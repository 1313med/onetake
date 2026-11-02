/**
 * Prove Remotion UGC pack against a short synthetic / sample plate.
 * Writes frames next to references/before_after for visual compare.
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { renderUgCVariant } = require('./render');

const ROOT = path.join(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'references', 'before_after', 'remotion_prove');
const FRAMES_DIR = path.join(OUT_DIR, 'frames');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-800) || `${cmd} ${code}`))));
  });
}

function findFfmpeg() {
  try {
    return require('@ffmpeg-installer/ffmpeg').path;
  } catch {
    return 'ffmpeg';
  }
}

async function ensurePlate() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const plate = path.join(OUT_DIR, 'plate.mp4');
  if (fs.existsSync(plate) && fs.statSync(plate).size > 50_000) return plate;

  // Prefer real sample if present
  const candidates = [
    path.join(ROOT, 'server', 'uploads'),
    path.join(ROOT, 'server', 'jobs'),
    path.join(ROOT, 'assets'),
  ];
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    const walk = (d, depth = 0) => {
      if (depth > 3) return null;
      for (const name of fs.readdirSync(d)) {
        const full = path.join(d, name);
        let st;
        try {
          st = fs.statSync(full);
        } catch {
          continue;
        }
        if (st.isDirectory()) {
          const hit = walk(full, depth + 1);
          if (hit) return hit;
        } else if (/\.(mp4|mov)$/i.test(name) && st.size > 200_000) {
          return full;
        }
      }
      return null;
    };
    const hit = walk(dir);
    if (hit) {
      // Trim ~8s talking-head-ish plate
      await run(findFfmpeg(), [
        '-y',
        '-ss',
        '0',
        '-t',
        '8',
        '-i',
        hit,
        '-vf',
        'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '20',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        plate,
      ]);
      return plate;
    }
  }

  // Synthetic color plate with face-like oval (no source available)
  await run(findFfmpeg(), [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=0x2a1f18:s=1080x1920:d=8',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=220:sample_rate=44100:duration=8',
    '-vf',
    "drawbox=x=340:y=520:w=400:h=520:color=0xd4a574:t=fill,drawtext=text='TALKER':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=1200",
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    plate,
  ]);
  return plate;
}

async function main() {
  const plate = await ensurePlate();
  const outMp4 = path.join(OUT_DIR, 'ugc_after_sample.mp4');

  const plan = {
    id: 'variant_a',
    captionStyle: 'viral',
    grade: 'viral',
    timeline: [
      { id: 'c0', srcStart: 0, srcEnd: 2.2, text: 'wach 3lach مهم؟', role: 'hook' },
      { id: 'c1', srcStart: 2.2, srcEnd: 4.5, text: 'ناس و تليفون', role: 'body' },
      { id: 'c2', srcStart: 4.5, srcEnd: 6.5, text: 'قصة cover', role: 'body' },
      { id: 'c3', srcStart: 6.5, srcEnd: 8.0, text: 'الحقيقة', role: 'payoff' },
    ],
    effectBeats: [
      { atSec: 0.2, durSec: 2.0, effectId: 'headlineWall', text: 'WAKE', intensity: 1.3 },
      { atSec: 1.8, durSec: 2.2, effectId: 'phoneMockup', text: 'APP', line: 'ناس و تليفون', intensity: 1.1 },
      { atSec: 3.6, durSec: 2.0, effectId: 'glassType', text: 'مهم', line: 'wach 3lach؟', intensity: 1.2 },
      { atSec: 5.0, durSec: 1.8, effectId: 'checklist', text: 'Point', line: 'One · Two · Three', intensity: 1 },
      { atSec: 5.8, durSec: 1.6, effectId: 'zoomThrough', text: 'NOW', intensity: 1.3 },
      { atSec: 6.6, durSec: 1.4, effectId: 'frameBreak', text: 'AFTER', intensity: 1.1 },
      { atSec: 7.0, durSec: 1.0, effectId: 'pullBackReveal', text: 'TRUTH', intensity: 1.2 },
    ],
    captions: [
      { start: 0.2, end: 2.0, text: 'wach 3lach مهم؟' },
      { start: 2.2, end: 4.2, text: 'ناس و تليفون' },
      { start: 4.5, end: 6.2, text: 'قصة cover' },
      { start: 6.5, end: 7.9, text: 'الحقيقة' },
    ],
  };

  console.log('[prove] plate:', plate);
  await renderUgCVariant({
    sourcePath: plate,
    plan,
    outPath: outMp4,
    onProgress: (p, msg) => console.log(`[prove] ${(p * 100).toFixed(0)}% ${msg}`),
  });

  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  await run(findFfmpeg(), [
    '-y',
    '-i',
    outMp4,
    '-vf',
    'fps=1',
    path.join(FRAMES_DIR, 'after_%03d.jpg'),
  ]);

  const styleNotes = path.join(ROOT, 'references', 'before_after', 'STYLE.md');
  if (!fs.existsSync(styleNotes)) {
    fs.writeFileSync(
      styleNotes,
      `# Before / After UGC style notes

Reference frames live in \`frames/\` (from Ibrahim Yousef AE promo).
Remotion prove output: \`remotion_prove/ugc_after_sample.mp4\` + \`remotion_prove/frames/\`.

Target vibe:
- Polaroid / magazine frame crops (frameBreak, coverStory)
- Frosted glass type panels (glassType)
- Phone mockup quote cards (phoneMockup)
- Checklist ticks on spoken points
- Punch zoom rings + pull-back reveals
- Heavy grade overlays; RTL Darija/Arabic type

Presenter face stays the plate; graphics layer on top.
`,
      'utf8'
    );
  }

  console.log('[prove] wrote', outMp4);
  console.log('[prove] frames', FRAMES_DIR);
}

main().catch((e) => {
  console.error('[prove] failed', e);
  process.exit(1);
});
