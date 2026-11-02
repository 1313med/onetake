import React from 'react';
import type { EffectBeat } from '../types';
import { GlassType } from './GlassType';
import { HeadlineWall } from './HeadlineWall';
import { PhoneMockup } from './PhoneMockup';
import { Checklist } from './Checklist';
import { ZoomThrough } from './ZoomThrough';
import { FrameBreak } from './FrameBreak';
import { PullBackReveal } from './PullBackReveal';
import {
  ChartGrow,
  CoverStory,
  DigitalZoom,
  DoodleBoil,
  OrbitCrop,
  PaperCut,
  UiWorld,
} from './Secondary';
import { BrandCard, FoodPop, FreeBurst } from './Entity';
import { StampSlam } from './StampSlam';
import { DocMock } from './DocMock';
import { CoverStill } from './CoverStill';
import { TopicBlast } from './TopicBlast';

/** Effects safe as full-bleed cutaways (opaque / self-contained). */
export const FULL_BLEED_SAFE = new Set([
  'topicBlast',
  'phoneMockup',
  'checklist',
  'brandCard',
  'foodPop',
  'freeBurst',
  'stampSlam',
  'docMock',
  'coverStill',
  'coverStory',
  'uiWorld',
  'chartGrow',
]);

/** Overlay-only comps — transparent; must NOT be used as solo cutaways. */
const OVERLAY_ONLY = new Set([
  'headlineWall',
  'glassType',
  'zoomThrough',
  'digitalZoom',
  'frameBreak',
  'pullBackReveal',
  'orbitCrop',
  'paperCut',
  'doodleBoil',
]);

const MAP: Record<string, React.FC<any>> = {
  glassType: GlassType,
  headlineWall: HeadlineWall,
  phoneMockup: PhoneMockup,
  checklist: Checklist,
  zoomThrough: ZoomThrough,
  frameBreak: FrameBreak,
  pullBackReveal: PullBackReveal,
  coverStory: CoverStory,
  coverStill: CoverStill,
  topicBlast: TopicBlast,
  uiWorld: UiWorld,
  chartGrow: ChartGrow,
  orbitCrop: OrbitCrop,
  paperCut: PaperCut,
  digitalZoom: DigitalZoom,
  doodleBoil: DoodleBoil,
  brandCard: BrandCard,
  foodPop: FoodPop,
  freeBurst: FreeBurst,
  stampSlam: StampSlam,
  docMock: DocMock,
};

function resolveCutawayId(effectId: string) {
  if (FULL_BLEED_SAFE.has(effectId)) return effectId;
  if (OVERLAY_ONLY.has(effectId) || !MAP[effectId]) return 'topicBlast';
  return effectId;
}

export const EffectLayer: React.FC<{
  beat: EffectBeat;
  durationInFrames: number;
  fullBleed?: boolean;
}> = ({ beat, durationInFrames, fullBleed }) => {
  const rawId = String(beat.effectId || 'topicBlast');
  const effectId = fullBleed ? resolveCutawayId(rawId) : rawId;

  if (fullBleed && beat.stillUri && (effectId === 'coverStory' || effectId === 'coverStill' || effectId === 'docMock')) {
    return (
      <CoverStill
        text={beat.text}
        line={beat.line}
        stillUri={beat.stillUri}
        assetKey={beat.assetKey}
        durationInFrames={durationInFrames}
        intensity={beat.intensity || 1}
        motion={beat.motion || 'snap'}
      />
    );
  }

  const Comp = MAP[effectId] || TopicBlast;
  return (
    <Comp
      text={beat.text}
      line={beat.line}
      emoji={beat.emoji}
      stillUri={beat.stillUri}
      assetKey={beat.assetKey}
      durationInFrames={durationInFrames}
      intensity={beat.intensity || 1.15}
      motion={beat.motion || (fullBleed ? 'slam' : 'snap')}
      fullBleed={fullBleed}
    />
  );
};

export { MAP as EFFECT_MAP, resolveCutawayId };
