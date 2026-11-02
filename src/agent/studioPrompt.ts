/**
 * Runtime system prompt for the OneTake Super Editor agent.
 * Keep in sync with STUDIO_CONSTITUTION.md
 */
export const STUDIO_SYSTEM_PROMPT = `
You are OneTake — an elite AI personal video production studio (Super Editor), not a basic editor.

GOLDEN RULE: Understand the ENTIRE recording before editing. Never decide from isolated sentences. Preserve meaning. Handle Darija/Arabic/French/English code-switching as one message.

NARRATIVE: Build beginning–middle–end. Remove silence, weak takes, accidental repeats. NEVER invent dialogue. If they repeat a line, pick the best delivery, then move to the next idea.

OUTPUT: THREE A/B variants of the SAME cleaned continuous story (~95–110s) — NOT chronological slices and NOT unrelated genre remakes. Variants differ by hook entry, caption style, music bed, and motion intensity only.

VARIANTS:
1) Variant A — earliest hook · bold captions · ducked bed · punch-ins
2) Variant B — slightly later entry · quiet music · sparse type
3) Variant C — warm grade · elegant captions · mid hook

AUDIO: Clarify voice, duck music under speech. Music matches emotion — never over voice.
VISUAL: 9:16, jump cuts, sparse emoji/word pops, captions synced to speech.
QC: complete idea, strong open, accurate captions, balanced audio, finished feel.
`.trim();

export type StudioVersionId =
  | 'variant_a'
  | 'variant_b'
  | 'variant_c'
  | 'variant_d'
  | 'variant_e';

export interface StudioVersionSpec {
  id: StudioVersionId;
  name: string;
  teamLead: string;
  thesis: string;
  editStyle: 'fast-cuts' | 'clean-minimal' | 'text-heavy' | 'cinematic' | 'storytime';
  musicMood: 'viral-energy' | 'soft-emotional' | 'trend-audio' | 'voice-forward' | 'dark-pulse';
  musicLabel: string;
  pace: 'slow' | 'medium' | 'fast';
  overlayStyle: 'bold' | 'minimal' | 'lyric' | 'bilingual' | 'neon';
  captionIdentity: string;
  assembly: 'hook-first' | 'emotion-arc' | 'linear-clean' | 'pulse-montage' | 'art-reframe';
}

export const STUDIO_VERSIONS: StudioVersionSpec[] = [
  {
    id: 'variant_a',
    name: 'Variant 1 · Hook punch',
    teamLead: 'Super Editor',
    thesis: 'Same cleaned spine; earliest hook with bold captions and punch-ins.',
    editStyle: 'fast-cuts',
    musicMood: 'viral-energy',
    musicLabel: 'Variant A bed · ducked under speech',
    pace: 'fast',
    overlayStyle: 'bold',
    captionIdentity: 'Bold impact type · keyword pops',
    assembly: 'hook-first',
  },
  {
    id: 'variant_b',
    name: 'Variant 2 · Clean story',
    teamLead: 'Super Editor',
    thesis: 'Same spine; quieter music and sparse captions.',
    editStyle: 'clean-minimal',
    musicMood: 'voice-forward',
    musicLabel: 'Near-silent bed · voice is hero',
    pace: 'medium',
    overlayStyle: 'minimal',
    captionIdentity: 'Clean sans · high readability',
    assembly: 'linear-clean',
  },
  {
    id: 'variant_c',
    name: 'Variant 3 · Warm cut',
    teamLead: 'Super Editor',
    thesis: 'Same spine; warm grade and elegant type.',
    editStyle: 'cinematic',
    musicMood: 'soft-emotional',
    musicLabel: 'Warm pads · sparse',
    pace: 'slow',
    overlayStyle: 'bilingual',
    captionIdentity: 'Premium light type · lower-third',
    assembly: 'emotion-arc',
  },
  {
    id: 'variant_d',
    name: 'Variant 4 · Kinetic',
    teamLead: 'Super Editor',
    thesis: 'Same spine; kinetic captions and stronger motion.',
    editStyle: 'text-heavy',
    musicMood: 'trend-audio',
    musicLabel: 'Pulse bed · sidechained feel',
    pace: 'fast',
    overlayStyle: 'lyric',
    captionIdentity: 'Kinetic type · word emphasis',
    assembly: 'pulse-montage',
  },
  {
    id: 'variant_e',
    name: 'Variant 5 · Soft blend',
    teamLead: 'Super Editor',
    thesis: 'Same spine; alt hook and soft transitions.',
    editStyle: 'storytime',
    musicMood: 'dark-pulse',
    musicLabel: 'Textured bed',
    pace: 'medium',
    overlayStyle: 'neon',
    captionIdentity: 'Experimental type · selective emphasis',
    assembly: 'art-reframe',
  },
];
