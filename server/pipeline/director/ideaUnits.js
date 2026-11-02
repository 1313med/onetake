/**
 * Build idea units from timed segments using pause gaps + length —
 * real structure from transcript, not random cuts.
 */

function buildIdeaUnits(segments, opts = {}) {
  const pauseGap = opts.pauseGapSec ?? 1.4;
  const units = [];
  let cur = null;

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (!s.text || s.end <= s.start) continue;
    if (!cur) {
      cur = {
        id: `iu_${units.length + 1}`,
        start: s.start,
        end: s.end,
        text: s.text,
        segmentIndices: [i],
        importance: 0,
      };
      continue;
    }
    const gap = s.start - cur.end;
    if (gap >= pauseGap) {
      cur.importance = scoreImportance(cur);
      units.push(cur);
      cur = {
        id: `iu_${units.length + 1}`,
        start: s.start,
        end: s.end,
        text: s.text,
        segmentIndices: [i],
        importance: 0,
      };
    } else {
      cur.end = s.end;
      cur.text = `${cur.text} ${s.text}`.trim();
      cur.segmentIndices.push(i);
    }
  }
  if (cur) {
    cur.importance = scoreImportance(cur);
    units.push(cur);
  }
  return units;
}

function scoreImportance(unit) {
  const dur = unit.end - unit.start;
  const words = unit.text.split(/\s+/).length;
  let score = Math.min(dur, 40) * 0.4 + Math.min(words, 60) * 0.2;
  if (/[?؟]|why|wach|3lach|comment|pourquoi/i.test(unit.text)) score += 1.2;
  if (/important|jamais|never|khass|nécessaire|خص|مهم/i.test(unit.text)) score += 1;
  return score;
}

module.exports = { buildIdeaUnits, scoreImportance };
