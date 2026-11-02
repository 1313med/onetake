/**
 * Node bridge: bundle once, render UgCReel MP4s for Super Editor variants.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ENTRY = path.join(__dirname, 'src', 'index.ts');
const PUBLIC_DIR = path.join(__dirname, 'public');

let bundlePromise = null;
let cachedServeUrl = null;
/** Bump when Remotion comps/plates change so long-lived servers rebundle. */
const REMOTION_BUILD = 'ugc-cutaway-v5';
let bundledBuild = null;

const CUTAWAY_ASSETS = path.join(__dirname, '..', 'assets', 'cutaways');

function copyIntoPublicTrees(relName, absSource, serveUrl) {
  const dest = path.join(PUBLIC_DIR, relName);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(dest) || fs.statSync(dest).size !== fs.statSync(absSource).size) {
    fs.copyFileSync(absSource, dest);
  }
  if (serveUrl && fs.existsSync(serveUrl)) {
    const bundleDest = path.join(serveUrl, 'public', relName);
    fs.mkdirSync(path.dirname(bundleDest), { recursive: true });
    if (!fs.existsSync(bundleDest) || fs.statSync(bundleDest).size !== fs.statSync(absSource).size) {
      fs.copyFileSync(absSource, bundleDest);
    }
  }
  return relName.replace(/\\/g, '/');
}

/** Resolve optional still under server/assets/cutaways/** and stage into public/cutaways/. */
function resolveStillUri(assetKey, serveUrl) {
  if (!assetKey) return null;
  const key = String(assetKey).replace(/[^\w\-./]+/g, '');
  const exts = ['.jpg', '.jpeg', '.png', '.webp'];
  const tries = [];
  for (const ext of exts) {
    tries.push(path.join(CUTAWAY_ASSETS, `${key}${ext}`));
    // also theme/key.ext layout: visa/passport.png with assetKey "visa/passport"
    const parts = key.split(/[\\/]/);
    if (parts.length === 1) {
      for (const theme of ['visa', 'food', 'marketing', 'general']) {
        tries.push(path.join(CUTAWAY_ASSETS, theme, `${key}${ext}`));
      }
    }
  }
  for (const abs of tries) {
    if (fs.existsSync(abs) && fs.statSync(abs).size > 200) {
      const base = path.basename(abs);
      return copyIntoPublicTrees(path.join('cutaways', base), abs, serveUrl);
    }
  }
  return null;
}

/** Stage source into project public/ and the live webpack bundle public/ (post-bundle). */
function stageSourceInPublic(sourcePath, serveUrl) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  const hash = crypto.createHash('sha1').update(path.resolve(sourcePath)).digest('hex').slice(0, 12);
  const assetName = `src_${hash}${path.extname(sourcePath) || '.mp4'}`;
  const dest = path.join(PUBLIC_DIR, assetName);
  if (!fs.existsSync(dest) || fs.statSync(dest).size !== fs.statSync(sourcePath).size) {
    fs.copyFileSync(sourcePath, dest);
  }
  // Bundle copies public/ at bundle-time; also inject into the active serve folder.
  if (serveUrl && fs.existsSync(serveUrl)) {
    const bundlePublic = path.join(serveUrl, 'public');
    fs.mkdirSync(bundlePublic, { recursive: true });
    const bundleDest = path.join(bundlePublic, assetName);
    if (!fs.existsSync(bundleDest) || fs.statSync(bundleDest).size !== fs.statSync(sourcePath).size) {
      fs.copyFileSync(sourcePath, bundleDest);
    }
  }
  return assetName;
}

async function getServeUrl() {
  if (
    cachedServeUrl &&
    bundledBuild === REMOTION_BUILD &&
    process.env.REMOTION_REBUNDLE !== '1'
  ) {
    return cachedServeUrl;
  }
  bundlePromise = null;
  cachedServeUrl = null;
  if (!bundlePromise) {
    bundlePromise = (async () => {
      const { bundle } = require('@remotion/bundler');
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
      const serveUrl = await bundle({
        entryPoint: ENTRY,
        publicDir: PUBLIC_DIR,
        webpackOverride: (config) => config,
      });
      cachedServeUrl = serveUrl;
      bundledBuild = REMOTION_BUILD;
      return serveUrl;
    })().catch((err) => {
      bundlePromise = null;
      bundledBuild = null;
      throw err;
    });
  }
  return bundlePromise;
}

/**
 * @param {object} opts
 * @param {string} opts.sourcePath absolute path to talking-head source
 * @param {object} opts.plan Super Editor plan (timeline, effectBeats, captions, …)
 * @param {string} opts.outPath output mp4
 * @param {(p:number,msg:string)=>void} [opts.onProgress]
 */
async function renderUgCVariant({ sourcePath, plan, outPath, onProgress }) {
  const { renderMedia, selectComposition } = require('@remotion/renderer');

  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error(`Remotion: source missing: ${sourcePath}`);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const serveUrl = await getServeUrl();
  onProgress?.(0.08, 'Remotion bundle ready');

  const assetName = stageSourceInPublic(sourcePath, serveUrl);

  const inputProps = {
    sourceUri: assetName,
    timeline: (plan.timeline || []).map((c) => {
      const stillUri = c.stillUri || resolveStillUri(c.assetKey, serveUrl);
      return {
        id: c.id,
        srcStart: c.srcStart,
        srcEnd: c.srcEnd,
        text: c.text,
        line: c.line,
        role: c.role,
        plateId: c.plateId || null,
        plateMode: c.plateMode || null,
        motion: c.motion || null,
        emoji: c.emoji || null,
        assetKey: c.assetKey || null,
        stillUri: stillUri || null,
        keepVoice: c.keepVoice !== false,
        transitionIn: c.transitionIn || null,
        camera: c.camera,
      };
    }),
    effectBeats: (plan.effectBeats || []).map((b) => ({
      ...b,
      stillUri: b.stillUri || resolveStillUri(b.assetKey, serveUrl),
    })),
    captions: (plan.captions || []).map((c) => ({
      start: c.start,
      end: c.end,
      text: c.text,
      emphasize: c.emphasize,
      highlightLatin: c.highlightLatin,
      anim: c.anim || 'pop',
      style: c.style,
      lang: c.lang,
    })),
    captionStyle: plan.captionStyle || 'viral',
    grade: plan.grade || 'viral',
    fps: 30,
    width: 1080,
    height: 1920,
  };

  const composition = await selectComposition({
    serveUrl,
    id: 'UgCReel',
    inputProps,
  });

  onProgress?.(0.15, `Remotion render ${plan.id || 'variant'} (${composition.durationInFrames}f)`);

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outPath,
    inputProps,
    publicDir: PUBLIC_DIR,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
    },
    onProgress: ({ progress }) => {
      onProgress?.(0.15 + progress * 0.8, `Remotion ${(progress * 100).toFixed(0)}%`);
    },
  });

  onProgress?.(0.97, 'Remotion encode done');
  return outPath;
}

/** Optional: mux music bed under Remotion video via FFmpeg (caller-owned). */
function clearBundleCache() {
  cachedServeUrl = null;
  bundlePromise = null;
}

module.exports = {
  renderUgCVariant,
  getServeUrl,
  clearBundleCache,
  stageSourceInPublic,
  PUBLIC_DIR,
};
