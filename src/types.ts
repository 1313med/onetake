export type Language = 'en' | 'fr' | 'ar' | 'darija';
export type Goal = 'views' | 'saves' | 'followers' | 'sales';
export type AppStep = 'home' | 'setup' | 'processing' | 'results' | 'detail';

export type EditStyle =
  | 'fast-cuts'
  | 'clean-minimal'
  | 'text-heavy'
  | 'cinematic'
  | 'storytime';

export type MusicMood =
  | 'viral-energy'
  | 'soft-emotional'
  | 'trend-audio'
  | 'voice-forward'
  | 'dark-pulse';

export interface ProjectInput {
  uri: string;
  fileName?: string;
  durationMillis?: number | null;
  niche: string;
  spokenNotes: string;
  goal: Goal;
  languages: Language[];
  cta: string;
}

export interface SpokenLine {
  text: string;
  emphasis?: boolean;
}

export interface VariantCopy {
  hook: string;
  lyrics: SpokenLine[];
  onScreenText: string[];
  caption: string;
  pinnedComment: string;
  hashtags: string[];
  spokenScript: string;
}

export interface VoiceDesign {
  treatment: string;
  keepYourVoice: boolean;
  notes: string[];
}

export interface VariantEdit {
  startMs: number;
  endMs: number;
  rate: number;
  zoom: number;
  muteOriginal: boolean;
  musicUrl: string | null;
  musicVolume: number;
  grade: {
    tint: string;
    vignette: number;
    contrast: number;
    saturationLabel: string;
  };
  jumpCutEveryMs: number;
  jumpCutSkipMs: number;
  letterbox: boolean;
  hookHoldMs: number;
  recipe: string[];
}

export interface QualityCheck {
  completeIdea: boolean;
  contextClear: boolean;
  essentialsKept: boolean;
  strongOpen: boolean;
  coherentNarrative: boolean;
  captionsAccurate: boolean;
  audioBalanced: boolean;
  endingComplete: boolean;
  distinctFromOthers: boolean;
  publicationReady: boolean;
}

export interface Variant {
  id: string;
  index: number;
  name: string;
  teamLead: string;
  hypothesis: string;
  language: Language;
  editStyle: EditStyle;
  musicMood: MusicMood;
  musicLabel: string;
  pace: 'slow' | 'medium' | 'fast';
  overlayStyle: 'bold' | 'minimal' | 'lyric' | 'bilingual' | 'neon';
  scrollStopScore: number;
  whyItMightWin: string;
  copy: VariantCopy;
  voice: VoiceDesign;
  qualityNotes: string[];
  qualityCheck: QualityCheck;
  captionIdentity: string;
  recommendedPostOrder: number;
  edit: VariantEdit;
  finishedDurationSec: number;
}

export interface GenerationResult {
  summary: string;
  topic: string;
  analysis: {
    rawDurationSec: number;
    takesDetected: number;
    subject: string;
    languagesDetected: string[];
    storyBeats: string[];
    bestMoments: string[];
    audience: string;
    removed: string[];
    preserved: string[];
  };
  variants: Variant[];
  postFirstIds: string[];
  testPlan: string[];
}
