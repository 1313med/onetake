export type EffectId =
  | 'phoneMockup'
  | 'glassType'
  | 'checklist'
  | 'zoomThrough'
  | 'orbitCrop'
  | 'paperCut'
  | 'coverStory'
  | 'uiWorld'
  | 'chartGrow'
  | 'frameBreak'
  | 'headlineWall'
  | 'digitalZoom'
  | 'doodleBoil'
  | 'pullBackReveal'
  | 'brandCard'
  | 'foodPop'
  | 'freeBurst'
  | 'stampSlam'
  | 'docMock'
  | 'coverStill'
  | 'topicBlast';

export type EffectBeat = {
  atSec: number;
  durSec: number;
  effectId: EffectId | string;
  text?: string | null;
  line?: string | null;
  emoji?: string | null;
  assetKey?: string | null;
  stillUri?: string | null;
  sfx?: string | null;
  intensity?: number;
  reason?: string;
  clipId?: string;
  motion?: 'snap' | 'slam' | 'bounce' | 'type' | 'spin' | string;
  mode?: 'overlay' | 'accent' | 'cutaway' | string;
};

export type TimelineClip = {
  id?: string;
  srcStart: number;
  srcEnd: number;
  text?: string;
  line?: string;
  role?: string;
  plateId?: string | null;
  plateMode?: 'full' | 'pip' | string;
  motion?: string;
  emoji?: string | null;
  assetKey?: string | null;
  stillUri?: string | null;
  keepVoice?: boolean;
  transitionIn?: { type?: string; duration?: number; reason?: string };
  camera?:
    | { scale?: number; panX?: number; panY?: number }
    | Array<{ t?: number; zoom?: number; cx?: number; cy?: number; reason?: string }>;
};

export type CaptionCue = {
  start: number;
  end: number;
  text: string;
  emphasize?: string[];
  highlightLatin?: boolean;
  anim?: string;
  style?: string;
  lang?: string;
};

export type UgCReelProps = {
  sourceUri: string;
  timeline: TimelineClip[];
  effectBeats: EffectBeat[];
  captions: CaptionCue[];
  captionStyle: string;
  grade: string;
  fps: number;
  width: number;
  height: number;
};
