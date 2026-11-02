import type { Variant } from '../types';

/**
 * Renders a downloadable WebM of one variant on web:
 * source video + grade tint + burned hook/captions.
 * (Hackathon-friendly compositor — not a full pro NLE.)
 */
export async function exportVariantWeb(
  sourceUri: string,
  variant: Variant,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Export is only available on web');
  }

  const video = document.createElement('video');
  video.src = sourceUri;
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  await waitForEvent(video, 'loadeddata');

  const edit = variant.edit;
  const W = 720;
  const H = 1280;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: pickMime(),
    videoBitsPerSecond: 4_500_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
    recorder.onerror = () => reject(new Error('Recording failed'));
  });

  const startSec = (edit.startMs || 0) / 1000;
  video.currentTime = startSec;
  await waitForEvent(video, 'seeked');
  video.playbackRate = edit.rate || 1;

  recorder.start(100);
  await video.play();

  const durationMs = Math.min(
    12000,
    edit.endMs ? edit.endMs - edit.startMs : 10000
  );
  const started = performance.now();

  await new Promise<void>((resolve) => {
    const draw = () => {
      const elapsed = performance.now() - started;
      onProgress?.(Math.min(99, (elapsed / durationMs) * 100));

      // Cover crop + zoom
      const zoom = edit.zoom || 1;
      const vw = video.videoWidth || W;
      const vh = video.videoHeight || H;
      const scale = Math.max(W / vw, H / vh) * zoom;
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (W - dw) / 2;
      const dy = (H - dh) / 2;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(video, dx, dy, dw, dh);

      // Grade tint
      if (edit.grade.tint && edit.grade.tint !== 'transparent') {
        ctx.fillStyle = edit.grade.tint;
        ctx.fillRect(0, 0, W, H);
      }

      if (edit.letterbox) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, 48);
        ctx.fillRect(0, H - 48, W, 48);
      }

      // Hook / captions
      const hook = variant.copy.hook;
      roundRect(ctx, 28, 64, W - 56, 96, 18, 'rgba(0,0,0,0.72)');
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px system-ui, sans-serif';
      wrapText(ctx, hook, 44, 104, W - 88, 34);

      const line =
        variant.copy.onScreenText[Math.floor(elapsed / 1800) % variant.copy.onScreenText.length];
      roundRect(ctx, W * 0.12, H * 0.72, W * 0.76, 56, 14, 'rgba(0,0,0,0.65)');
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(line, W / 2, H * 0.72 + 36);
      ctx.textAlign = 'left';

      // Cut badge
      ctx.fillStyle = '#FF4D6D';
      roundRect(ctx, W - 140, 28, 112, 36, 18, '#FF4D6D');
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(`CUT ${variant.index}`, W - 118, 52);

      if (elapsed < durationMs && !video.ended && !video.paused) {
        requestAnimationFrame(draw);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(draw);
  });

  video.pause();
  recorder.stop();
  onProgress?.(100);
  return done;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) return 'video/webm;codecs=vp9';
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) return 'video/webm;codecs=vp8';
  return 'video/webm';
}

function waitForEvent(el: HTMLMediaElement, event: string) {
  return new Promise<void>((resolve, reject) => {
    const ok = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error(`Media event failed: ${event}`));
    };
    const cleanup = () => {
      el.removeEventListener(event, ok);
      el.removeEventListener('error', fail);
    };
    el.addEventListener(event, ok, { once: true });
    el.addEventListener('error', fail, { once: true });
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string
) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (let n = 0; n < words.length; n += 1) {
    const test = `${line}${words[n]} `;
    if (ctx.measureText(test).width > maxWidth && n > 0) {
      ctx.fillText(line, x, yy);
      line = `${words[n]} `;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}
