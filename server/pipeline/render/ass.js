const fs = require('fs');

/**
 * 2026 UGC ASS captions + motion graphics.
 * Uses ASS \t transforms for pop / scale / fade (libass via FFmpeg).
 */

function escapeAss(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\N');
}

function assHeader(styleName) {
  // Fonts common on Windows; bold + heavy outline = TikTok/Reels look
  const styles = {
    viral:
      'Arial Black,72,&H00FFFFFF,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,1,5,0,2,48,48,220,1',
    cinematic:
      'Segoe UI,58,&H00F5F0E8,&H000000FF,&H00181818,&H80000000,0,0,0,0,100,100,1,0,1,3,0,2,56,56,200,1',
    documentary:
      'Segoe UI Semibold,56,&H00FFFFFF,&H000000FF,&H00000000,&H70000000,0,0,0,0,100,100,0,0,1,3,0,2,52,52,190,1',
    kinetic:
      'Impact,78,&H0000F0FF,&H000000FF,&H00000000,&HA0000000,-1,0,0,0,100,100,0,0,1,6,0,2,40,40,230,1',
    experimental:
      'Arial Black,70,&H00FF7AD9,&H000000FF,&H00200040,&HA0000000,-1,0,0,0,100,100,0,0,1,5,0,8,70,70,210,1',
  };
  const style = styles[styleName] || styles.viral;
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style}
Style: HookWord,Arial Black,92,&H0000E5FF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,6,0,5,40,40,40,1
Style: Badge,Segoe UI Black,48,&H00FFFFFF,&H000000FF,&H00000000,&HC0000000,-1,0,0,0,100,100,0,0,3,0,0,8,40,40,120,1
Style: Emoji,Segoe UI Emoji,140,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

function toAssTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** Pop-in: scale from 60→100 + fade over ~220ms */
function popTags(styleName) {
  if (styleName === 'documentary') {
    return '{\\fad(120,80)}';
  }
  if (styleName === 'cinematic') {
    return '{\\fad(160,100)\\t(0,280,\\fscx105\\fscy105)}{\\fscx92\\fscy92}';
  }
  // viral / kinetic / experimental — hard CapCut-style pop
  return '{\\fad(60,80)\\t(0,180,\\fscx100\\fscy100)\\t(180,320,\\fscx108\\fscy108)\\t(320,420,\\fscx100\\fscy100)}{\\fscx70\\fscy70}';
}

function accentColor(styleName) {
  const map = {
    viral: '&H0000D7FF&',
    kinetic: '&H0000F0FF&',
    experimental: '&H00FF7AD9&',
    cinematic: '&H00C8B8A0&',
    documentary: '&H00FFFFFF&',
  };
  return map[styleName] || map.viral;
}

function formatPhrase(text, styleName, hotWords) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '';
  const hot = new Set((hotWords || []).map((w) => String(w).toLowerCase()));
  const accent = accentColor(styleName);
  const kinetic = styleName === 'viral' || styleName === 'kinetic' || styleName === 'experimental';

  if (!kinetic || words.length === 1) {
    const joined = words
      .map((w) => {
        const esc = escapeAss(w);
        if (hot.has(w.toLowerCase()) || (kinetic && w.length >= 5 && /[!?؟]|مهم|khass|never/i.test(w))) {
          return `{\\c${accent}\\b1\\fscx112\\fscy112}${esc}{\\r}`;
        }
        return esc;
      })
      .join(' ');
    return `${popTags(styleName)}${joined}`;
  }

  // Multi-word: first word pops largest (UGC hook feel), rest follow
  return (
    popTags(styleName) +
    words
      .map((w, idx) => {
        const esc = escapeAss(w);
        if (idx === 0) return `{\\c${accent}\\b1\\fscx118\\fscy118}${esc}{\\r}`;
        if (hot.has(w.toLowerCase())) return `{\\c${accent}\\b1}${esc}{\\r}`;
        return esc;
      })
      .join(' ')
  );
}

function writeAssFile(captions, styleName, outPath, emphasizeWords = [], overlayEvents = []) {
  let body = assHeader(styleName);
  const hot = emphasizeWords || [];

  for (const cap of captions || []) {
    const start = Number(cap.start) || 0;
    let end = Number(cap.end) || start + 0.8;
    if (end <= start) end = start + 0.7;
    // Keep on-screen long enough to read
    end = Math.max(end, start + Math.min(2.4, 0.35 + String(cap.text || '').split(/\s+/).length * 0.18));
    const text = formatPhrase(cap.text, styleName || 'viral', hot);
    if (!text) continue;
    body += `Dialogue: 0,${toAssTime(start)},${toAssTime(end)},Default,,0,0,0,,${text}\n`;
  }

  for (const ov of overlayEvents || []) {
    const start = Number(ov.start) || 0;
    const end = Math.max(start + 0.55, Number(ov.end) || start + 1.4);
    const x = Math.round((ov.x != null ? ov.x : 0.5) * 1080);
    const y = Math.round((ov.y != null ? ov.y : 0.42) * 1920);
    const bounce =
      '{\\an5\\fad(80,120)\\t(0,160,\\fscx100\\fscy100)\\t(160,280,\\fscx118\\fscy118)\\t(280,400,\\fscx100\\fscy100)}{\\fscx55\\fscy55}';

    if (ov.type === 'word_pop' && ov.word) {
      const size = Number(ov.size) || 96;
      body += `Dialogue: 2,${toAssTime(start)},${toAssTime(end)},HookWord,,0,0,0,,${bounce}{\\pos(${x},${y})\\fs${size}}${escapeAss(ov.word)}\n`;
      continue;
    }
    if (ov.type === 'badge' && ov.word) {
      body += `Dialogue: 2,${toAssTime(start)},${toAssTime(end)},Badge,,0,0,0,,{\\an8\\fad(100,100)\\pos(${x},${Math.round(y * 0.55)})}${escapeAss(ov.word)}\n`;
      continue;
    }
    // emoji (default)
    const emoji = ov.emoji || '✨';
    const size = Number(ov.size) || 150;
    body += `Dialogue: 1,${toAssTime(start)},${toAssTime(end)},Emoji,,0,0,0,,${bounce}{\\pos(${x},${y})\\fs${size}}${emoji}\n`;
  }

  fs.writeFileSync(outPath, body, 'utf8');
  return outPath;
}

/** Map timeline clip overlays → absolute output-clock events */
function overlayEventsFromTimeline(timeline) {
  const events = [];
  let t = 0;
  for (const clip of timeline || []) {
    const dur = Math.max(0.2, clip.srcEnd - clip.srcStart);
    for (const ov of clip.overlays || []) {
      const at = Number(ov.at) || dur * 0.28;
      const hold = Number(ov.hold) || 1.35;
      events.push({
        type: ov.type || 'emoji',
        start: t + at,
        end: t + at + hold,
        emoji: ov.emoji,
        word: ov.word,
        x: ov.x,
        y: ov.y,
        size: ov.size,
        reason: ov.reason,
      });
    }
    t += dur;
  }
  return events;
}

module.exports = { writeAssFile, escapeAss, toAssTime, overlayEventsFromTimeline, formatPhrase };
