/**
 * Super Editor — three A/B variants of the same cleaned story spine.
 * Same speech edit; different hook/caption/music/motion/effect palette.
 */
const VARIANT_DEFS = [
  {
    id: 'variant_a',
    name: 'Variant 1 · Hook punch',
    captionStyle: 'viral',
    grade: 'viral',
    music: 'variant_a.mp3',
    musicVol: 0.26,
    softTargetSec: 100,
    hookOffsetRatio: 0,
    motion: 'punch',
    overlayMax: 12,
    allowXfade: false,
    chip: 'A/B smash cuts · kinetic captions · dense SFX',
    effectPalette: ['topicBlast', 'phoneMockup', 'freeBurst', 'brandCard', 'stampSlam', 'checklist'],
  },
  {
    id: 'variant_b',
    name: 'Variant 2 · Clean story',
    captionStyle: 'documentary',
    grade: 'doc',
    music: 'variant_b.mp3',
    musicVol: 0.18,
    softTargetSec: 105,
    hookOffsetRatio: 0.08,
    motion: 'subtle',
    overlayMax: 9,
    allowXfade: false,
    chip: 'PIP cutaways · checklist/phone · cooler grade',
    effectPalette: ['checklist', 'phoneMockup', 'docMock', 'topicBlast', 'uiWorld'],
  },
  {
    id: 'variant_c',
    name: 'Variant 3 · Warm cut',
    captionStyle: 'cinematic',
    grade: 'cinematic',
    music: 'variant_c.mp3',
    musicVol: 0.22,
    softTargetSec: 108,
    hookOffsetRatio: 0.15,
    motion: 'subtle',
    overlayMax: 10,
    allowXfade: false,
    chip: 'brand/food plates · warm grade · elegant type',
    effectPalette: ['brandCard', 'coverStill', 'foodPop', 'freeBurst', 'topicBlast', 'stampSlam'],
  },
];

/** @deprecated use VARIANT_DEFS — kept as alias for older imports */
const STYLE_DEFS = VARIANT_DEFS;

function emptyEditorial() {
  return {
    version: 2,
    engine: null,
    ideaUnits: [],
    takeGroups: [],
    discardedTakes: [],
    coverage: { mustIncludeIdeaIds: [] },
  };
}

module.exports = { VARIANT_DEFS, STYLE_DEFS, emptyEditorial };
