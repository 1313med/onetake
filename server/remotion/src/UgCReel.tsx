import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { EffectBeat, TimelineClip, UgCReelProps } from './types';
import { EffectLayer, resolveCutawayId } from './effects';
import { Captions } from './Captions';
import { FlashSmash } from './effects/shared';
import { gradeLook, COLORS } from './theme';

const DEFAULT_PROPS: UgCReelProps = {
  sourceUri: '',
  timeline: [],
  effectBeats: [],
  captions: [],
  captionStyle: 'viral',
  grade: 'viral',
  fps: 30,
  width: 1080,
  height: 1920,
};

function buildOutputTimeline(clips: TimelineClip[]) {
  let t = 0;
  return clips.map((c) => {
    const dur = Math.max(0.2, c.srcEnd - c.srcStart);
    const item = { ...c, outStart: t, outEnd: t + dur, dur };
    t += dur;
    return item;
  });
}

function sourceSrc(sourceUri: string) {
  return sourceUri.startsWith('http://') || sourceUri.startsWith('https://')
    ? sourceUri
    : staticFile(sourceUri.replace(/^\//, ''));
}

function cameraScale(clip: TimelineClip, punch: boolean) {
  const cam = clip.camera;
  if (cam && !Array.isArray(cam) && cam.scale) return cam.scale;
  if (Array.isArray(cam) && cam[0]?.zoom) return cam[0].zoom;
  return punch ? 1.14 : 1.08;
}

const GradeStack: React.FC<{ grade: string }> = ({ grade }) => {
  const look = gradeLook(grade);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ backgroundColor: look.wash, mixBlendMode: 'soft-light' }} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 42%, ${look.vignette} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: look.grain,
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 2px)',
          mixBlendMode: 'overlay',
        }}
      />
    </AbsoluteFill>
  );
};

const PunchCamera: React.FC<{
  clip: TimelineClip & { dur: number };
  sourceUri: string;
  punch: boolean;
  pulseBeats?: number[];
  dimmed?: boolean;
}> = ({ clip, sourceUri, punch, pulseBeats = [], dimmed }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const baseScale = cameraScale(clip, punch);
  const progress = frame / Math.max(1, clip.dur * fps);
  const pulseHz = punch ? 1.25 : 0.95;
  const wave = 0.5 + 0.5 * Math.sin(progress * Math.PI * 2 * pulseHz * Math.max(1, clip.dur));
  let scale = baseScale * (1 + wave * (punch ? 0.05 : 0.03));
  for (const beatAt of pulseBeats) {
    const local = beatAt - (clip as any).outStart;
    if (local < 0 || local > clip.dur) continue;
    const dist = frame - local * fps;
    if (dist >= 0 && dist < 10) {
      scale *= interpolate(dist, [0, 3, 10], [1.1, 1.04, 1], { extrapolateRight: 'clamp' });
    }
  }
  scale *= interpolate(frame, [0, 4, 10], [1.06, 1.015, 1], { extrapolateRight: 'clamp' });
  const panX = Math.sin(progress * Math.PI * 2) * (punch ? 5 : 2.5);
  const panY = Math.cos(progress * Math.PI * 1.4) * (punch ? 3.5 : 1.8);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <AbsoluteFill style={{ transform: `scale(${scale}) translate(${panX}px, ${panY}px)` }}>
        <OffthreadVideo
          src={sourceSrc(sourceUri)}
          startFrom={Math.floor(clip.srcStart * fps)}
          endAt={Math.floor(clip.srcEnd * fps)}
          style={{ width, height, objectFit: 'cover' }}
          muted={false}
        />
      </AbsoluteFill>
      {dimmed ? (
        <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * Cutaway / B-roll plate. Never a blank black frame:
 * - card: face stays, kinetic plate card covers mid frame
 * - pip: plate full + face PIP
 * - full: opaque plate (topicBlast etc.) with hidden voice bed
 */
const CutawayClip: React.FC<{
  clip: TimelineClip & { dur: number };
  sourceUri: string;
  punch: boolean;
}> = ({ clip, sourceUri, punch }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const rawPlate = clip.plateId || 'topicBlast';
  const plateId = resolveCutawayId(rawPlate);
  const mode = clip.plateMode === 'full' ? 'full' : clip.plateMode === 'pip' ? 'pip' : 'card';
  const durFrames = Math.max(1, Math.floor(clip.dur * fps));
  const beat: EffectBeat = {
    atSec: 0,
    durSec: clip.dur,
    effectId: plateId,
    text: clip.text,
    line: clip.line || clip.text,
    emoji: clip.emoji || '💡',
    assetKey: clip.assetKey,
    stillUri: clip.stillUri,
    intensity: 1.3,
    motion: clip.motion || 'slam',
    mode: 'cutaway',
  };
  const smash = clip.transitionIn?.type === 'smash' || clip.transitionIn?.type === 'flash';
  const slide = interpolate(frame, [0, 8], [80, 0], { extrapolateRight: 'clamp' });
  const cardScale = interpolate(frame, [0, 6, 12], [0.86, 1.06, 1], { extrapolateRight: 'clamp' });

  const voiceBed = (
    <AbsoluteFill style={{ opacity: 0, pointerEvents: 'none' }}>
      <OffthreadVideo
        src={sourceSrc(sourceUri)}
        startFrom={Math.floor(clip.srcStart * fps)}
        endAt={Math.floor(clip.srcEnd * fps)}
        style={{ width, height, objectFit: 'cover' }}
        muted={false}
      />
    </AbsoluteFill>
  );

  if (mode === 'card') {
    return (
      <AbsoluteFill style={{ backgroundColor: '#050508' }}>
        <PunchCamera clip={clip} sourceUri={sourceUri} punch={punch} dimmed />
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 36,
            transform: `translateY(${slide}px) scale(${cardScale})`,
          }}
        >
          <div
            style={{
              width: '92%',
              maxHeight: '62%',
              borderRadius: 28,
              overflow: 'hidden',
              border: `4px solid ${COLORS.gold}`,
              boxShadow: '0 28px 80px rgba(0,0,0,0.55)',
              background: '#0b0b0f',
            }}
          >
            <div style={{ height: 720, position: 'relative' }}>
              <EffectLayer beat={beat} durationInFrames={durFrames} fullBleed />
            </div>
          </div>
        </AbsoluteFill>
        {smash ? <FlashSmash frames={4} /> : null}
      </AbsoluteFill>
    );
  }

  if (mode === 'pip') {
    return (
      <AbsoluteFill style={{ backgroundColor: '#050508' }}>
        {voiceBed}
        <EffectLayer beat={beat} durationInFrames={durFrames} fullBleed />
        <div
          style={{
            position: 'absolute',
            width: 340,
            height: 480,
            right: 28,
            bottom: 250,
            borderRadius: 22,
            overflow: 'hidden',
            border: '3px solid rgba(255,255,255,0.4)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            zIndex: 6,
          }}
        >
          <OffthreadVideo
            src={sourceSrc(sourceUri)}
            startFrom={Math.floor(clip.srcStart * fps)}
            endAt={Math.floor(clip.srcEnd * fps)}
            style={{ width: 340, height: 480, objectFit: 'cover' }}
            muted
          />
        </div>
        {smash ? <FlashSmash frames={4} /> : null}
      </AbsoluteFill>
    );
  }

  // full opaque plate
  return (
    <AbsoluteFill style={{ backgroundColor: '#050508' }}>
      {voiceBed}
      <EffectLayer beat={beat} durationInFrames={durFrames} fullBleed />
      {smash ? <FlashSmash frames={4} /> : null}
    </AbsoluteFill>
  );
};

export const UgCReel: React.FC<Partial<UgCReelProps>> = (raw) => {
  const props = { ...DEFAULT_PROPS, ...raw };
  const { fps } = useVideoConfig();
  const outClips = useMemo(() => buildOutputTimeline(props.timeline || []), [props.timeline]);
  const punch = props.grade === 'viral' || props.grade === 'energy' || props.captionStyle === 'kinetic';

  const motionPulses = useMemo(() => {
    const times: number[] = [];
    for (const c of props.captions || []) {
      if ((c.end || 0) - (c.start || 0) >= 0.35) times.push(c.start);
    }
    for (const b of props.effectBeats || []) {
      if (b.mode !== 'accent') times.push(b.atSec);
    }
    return times;
  }, [props.captions, props.effectBeats]);

  // Face overlays only — never duplicate full-bleed cutaway windows
  const overlayBeats = useMemo(
    () =>
      (props.effectBeats || []).filter((b) => {
        if (b.mode === 'accent') return false;
        if (b.mode === 'cutaway') return false;
        return true;
      }),
    [props.effectBeats]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {outClips.map((clip, i) => {
        const from = Math.floor(clip.outStart * fps);
        const durFrames = Math.max(1, Math.floor(clip.dur * fps));
        const isCutaway = clip.role === 'cutaway' && clip.plateId;
        const localPulses = motionPulses.filter((t) => t >= clip.outStart && t < clip.outEnd);
        return (
          <Sequence key={clip.id || `c-${i}`} from={from} durationInFrames={durFrames}>
            {isCutaway ? (
              <CutawayClip clip={clip} sourceUri={props.sourceUri} punch={punch} />
            ) : (
              <PunchCamera
                clip={clip}
                sourceUri={props.sourceUri}
                punch={punch}
                pulseBeats={localPulses}
              />
            )}
          </Sequence>
        );
      })}

      {overlayBeats.map((beat: EffectBeat, i) => {
        const overlapsCutaway = outClips.some(
          (c) => c.role === 'cutaway' && beat.atSec >= c.outStart - 0.05 && beat.atSec < c.outEnd
        );
        if (overlapsCutaway) return null;
        // Overlay comps only — remap risky full plates that would cover face awkwardly
        const overlayBeat = {
          ...beat,
          effectId:
            beat.effectId === 'headlineWall' || beat.effectId === 'topicBlast'
              ? 'glassType'
              : beat.effectId,
        };
        const from = Math.floor(beat.atSec * fps);
        const durFrames = Math.max(1, Math.floor((beat.durSec || 1.4) * fps));
        return (
          <Sequence key={`fx-${i}-${beat.effectId}`} from={from} durationInFrames={durFrames} layout="none">
            <EffectLayer beat={overlayBeat} durationInFrames={durFrames} />
          </Sequence>
        );
      })}

      <Captions captions={props.captions || []} captionStyle={props.captionStyle} fps={fps} />
      <GradeStack grade={props.grade} />
    </AbsoluteFill>
  );
};

export const ugcReelSchemaDefaults = DEFAULT_PROPS;
