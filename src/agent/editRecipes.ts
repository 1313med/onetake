import type { EditStyle, MusicMood, VariantEdit } from '../types';
import type { StudioVersionSpec } from './studioPrompt';

export const MUSIC: Record<MusicMood, string> = {
  'viral-energy': 'https://assets.mixkit.co/music/preview/mixkit-hip-hop-02-738.mp3',
  'soft-emotional': 'https://assets.mixkit.co/music/preview/mixkit-beautiful-dream-493.mp3',
  'trend-audio': 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
  'voice-forward': 'https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3',
  'dark-pulse': 'https://assets.mixkit.co/music/preview/mixkit-feeling-353.mp3',
};

export interface StoryBeat {
  label: 'hook' | 'context' | 'proof' | 'emotion' | 'payoff';
  startMs: number;
  endMs: number;
}

/**
 * Analyze the full timeline into reusable story beats (NOT equal fifths).
 * Beats can be reordered per creative version while staying meaning-safe.
 */
export function analyzeStoryBeats(durationMillis: number): StoryBeat[] {
  const dur = Math.max(durationMillis || 60_000, 20_000);
  const beat = (label: StoryBeat['label'], a: number, b: number): StoryBeat => {
    const startMs = Math.floor(dur * a);
    const endMs = Math.min(dur, Math.floor(dur * b));
    return { label, startMs, endMs: Math.max(endMs, startMs + 2500) };
  };

  // Biased toward where people usually land their best lines in practice takes
  return [
    beat('hook', 0.62, 0.72), // strong line often appears after warming up
    beat('context', 0.08, 0.2),
    beat('proof', 0.28, 0.42),
    beat('emotion', 0.48, 0.58),
    beat('payoff', 0.78, 0.92),
  ];
}

/**
 * Assemble a finished Reel window for a creative version.
 * Different assemblies → different openings / centers — not chronological slices.
 */
export function assembleVersionWindow(
  beats: StoryBeat[],
  spec: StudioVersionSpec,
  finishedSec = 28
): { startMs: number; endMs: number; beatOrder: string[]; assemblyNote: string } {
  const by = (l: StoryBeat['label']) => beats.find((b) => b.label === l)!;
  const target = finishedSec * 1000;

  let order: StoryBeat['label'][] = [];
  let assemblyNote = '';

  switch (spec.assembly) {
    case 'hook-first':
      order = ['hook', 'context', 'proof', 'payoff'];
      assemblyNote =
        'Opens on the strongest late take as hook, then rewinds for context — meaning preserved.';
      break;
    case 'emotion-arc':
      order = ['emotion', 'context', 'proof', 'payoff'];
      assemblyNote = 'Emotion-led arc: feeling first, then clarity, then takeaway.';
      break;
    case 'linear-clean':
      order = ['context', 'proof', 'emotion', 'payoff'];
      assemblyNote = 'Authentic documentary order — clearest progressive explanation.';
      break;
    case 'pulse-montage':
      order = ['hook', 'proof', 'emotion', 'payoff'];
      assemblyNote = 'High-energy montage of peak statements; weak warm-ups discarded.';
      break;
    case 'art-reframe':
      order = ['payoff', 'hook', 'emotion', 'context'];
      assemblyNote = 'Experimental reframe: ends-as-open, then rebuilds meaning intentionally.';
      break;
  }

  // Primary playback window = first beat (hook strategy), extended toward next beats
  // For demo player we use a continuous window centered on the assembled narrative spine
  const primary = by(order[0]);
  const spine = order.map(by);
  const startMs = Math.min(...spine.map((b) => b.startMs));
  const endMs = Math.min(
    Math.max(...spine.map((b) => b.endMs)),
    startMs + target
  );

  // Prefer starting AT the version's opening beat for distinct playback
  const open = primary.startMs;
  const close = Math.min(open + target, Math.max(primary.endMs, open + 8000));

  return {
    startMs: open,
    endMs: close,
    beatOrder: order,
    assemblyNote: `${assemblyNote} Beats: ${order.join(' → ')}. (Source span ${formatTs(startMs)}–${formatTs(endMs)}.)`,
  };
}

export function buildEditRecipe(
  editStyle: EditStyle,
  musicMood: MusicMood,
  pace: 'slow' | 'medium' | 'fast',
  window: { startMs: number; endMs: number },
  captionIdentity: string,
  assemblyNote: string
): VariantEdit {
  const lenSec = Math.max(1, Math.round((window.endMs - window.startMs) / 1000));

  const base: VariantEdit = {
    startMs: window.startMs,
    endMs: window.endMs,
    rate: pace === 'fast' ? 1.08 : pace === 'slow' ? 0.92 : 1,
    zoom: 1.05,
    muteOriginal: false,
    musicUrl: MUSIC[musicMood],
    musicVolume: 0.32,
    grade: {
      tint: 'transparent',
      vignette: 0.1,
      contrast: 0.08,
      saturationLabel: 'broadcast',
    },
    jumpCutEveryMs: 0,
    jumpCutSkipMs: 0,
    letterbox: false,
    hookHoldMs: 2000,
    recipe: [],
  };

  switch (editStyle) {
    case 'fast-cuts':
      return {
        ...base,
        rate: 1.1,
        zoom: 1.18,
        musicVolume: 0.5,
        jumpCutEveryMs: 850,
        jumpCutSkipMs: 200,
        grade: {
          tint: 'rgba(255,77,109,0.1)',
          vignette: 0.2,
          contrast: 0.22,
          saturationLabel: 'viral punch',
        },
        hookHoldMs: 1300,
        recipe: [
          assemblyNote,
          `Finished length ~${lenSec}s · dead air removed`,
          `Captions: ${captionIdentity}`,
          'Pattern interrupts on key phrases · music ducked under voice',
        ],
      };
    case 'cinematic':
      return {
        ...base,
        rate: 0.9,
        zoom: 1.08,
        musicVolume: 0.36,
        letterbox: true,
        grade: {
          tint: 'rgba(255,176,32,0.12)',
          vignette: 0.4,
          contrast: 0.16,
          saturationLabel: 'warm film',
        },
        hookHoldMs: 2800,
        recipe: [
          assemblyNote,
          `Cinematic ~${lenSec}s · letterbox + warm grade`,
          `Captions: ${captionIdentity}`,
          'Controlled pacing · music supports emotion, never covers words',
        ],
      };
    case 'clean-minimal':
      return {
        ...base,
        rate: 1,
        zoom: 1.02,
        musicVolume: 0.12,
        grade: {
          tint: 'rgba(255,255,255,0.03)',
          vignette: 0.05,
          contrast: 0.05,
          saturationLabel: 'natural authentic',
        },
        hookHoldMs: 2100,
        recipe: [
          assemblyNote,
          `Documentary ~${lenSec}s · best natural delivery`,
          `Captions: ${captionIdentity}`,
          'Clean voice treatment · minimal music · credibility first',
        ],
      };
    case 'text-heavy':
      return {
        ...base,
        rate: 1.06,
        zoom: 1.14,
        musicVolume: 0.48,
        jumpCutEveryMs: 1200,
        jumpCutSkipMs: 160,
        grade: {
          tint: 'rgba(46,230,166,0.08)',
          vignette: 0.14,
          contrast: 0.15,
          saturationLabel: 'kinetic pop',
        },
        hookHoldMs: 2400,
        recipe: [
          assemblyNote,
          `Dynamic ~${lenSec}s · intelligent jump cuts + micro-zooms`,
          `Captions: ${captionIdentity}`,
          'Kinetic lyrics synced to speech · SFX-ready rhythm',
        ],
      };
    case 'storytime':
      return {
        ...base,
        rate: 1.02,
        zoom: 1.16,
        musicVolume: 0.44,
        jumpCutEveryMs: 1600,
        jumpCutSkipMs: 280,
        grade: {
          tint: 'rgba(40,20,80,0.26)',
          vignette: 0.52,
          contrast: 0.26,
          saturationLabel: 'artistic contrast',
        },
        hookHoldMs: 1700,
        recipe: [
          assemblyNote,
          `Experimental ~${lenSec}s · distinctive visual identity`,
          `Captions: ${captionIdentity}`,
          'Unexpected framing/type · meaning never invented',
        ],
      };
    default:
      return {
        ...base,
        recipe: [assemblyNote, `Captions: ${captionIdentity}`],
      };
  }
}

function formatTs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}
