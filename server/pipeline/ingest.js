const fs = require('fs');
const { probe } = require('./ffmpeg');

/**
 * Validate uploaded source before spending ASR/render time.
 * Rejects incomplete MOVs (missing moov) and files without A/V streams.
 */
async function validateSource(sourcePath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error('Source video missing. Re-upload the recording.');
  }
  const st = fs.statSync(sourcePath);
  if (st.size < 50_000) {
    throw new Error('Source video too small — upload looks incomplete. Re-upload from the phone.');
  }

  let meta;
  try {
    meta = await probe(sourcePath);
  } catch (err) {
    const msg = String(err.message || err);
    if (/moov atom not found/i.test(msg) || /Invalid data found/i.test(msg)) {
      throw new Error(
        'Upload incomplete (video container missing moov atom). Keep the app open until upload finishes, then Produce again.'
      );
    }
    throw new Error(`Cannot read source video: ${msg.slice(0, 300)}`);
  }

  const video = (meta.streams || []).find((s) => s.codec_type === 'video');
  const audio = (meta.streams || []).find((s) => s.codec_type === 'audio');
  const duration = Number(meta.format?.duration || 0);

  if (!video) throw new Error('Source has no video stream.');
  if (!audio) throw new Error('Source has no audio stream — cannot transcribe or edit speech.');
  if (!(duration > 1)) throw new Error('Source duration unreadable or too short.');

  return {
    ok: true,
    duration,
    width: video.width || 1080,
    height: video.height || 1920,
    fps: evalFraction(video.r_frame_rate) || 30,
    hasAudio: true,
    format: meta.format?.format_name || '',
  };
}

function evalFraction(rate) {
  if (!rate) return 30;
  if (String(rate).includes('/')) {
    const [a, b] = String(rate).split('/').map(Number);
    return b ? a / b : 30;
  }
  return Number(rate) || 30;
}

module.exports = { validateSource };
