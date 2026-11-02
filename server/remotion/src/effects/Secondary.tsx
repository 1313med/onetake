import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { BigType, EffectShell, GlassPanel } from './shared';
import { COLORS } from '../theme';

export const CoverStory: React.FC<{
  text?: string | null;
  durationInFrames: number;
  intensity?: number;
}> = ({ text, durationInFrames, intensity = 1 }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity}>
    {({ opacity, scale, y }) => (
      <AbsoluteFill style={{ opacity, justifyContent: 'center', alignItems: 'center' }}>
        <div
          style={{
            width: 900,
            padding: 36,
            background: COLORS.ink,
            border: `8px solid ${COLORS.gold}`,
            transform: `translateY(${y}px) scale(${scale})`,
          }}
        >
          <div style={{ color: COLORS.gold, letterSpacing: 8, fontSize: 22, marginBottom: 12 }}>COVER STORY</div>
          <BigType text={(text || 'STORY').toUpperCase()} size={96} align="left" color={COLORS.cream} />
        </div>
      </AbsoluteFill>
    )}
  </EffectShell>
);

export const UiWorld: React.FC<{
  text?: string | null;
  durationInFrames: number;
  intensity?: number;
}> = ({ text, durationInFrames, intensity = 1 }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity}>
    {({ opacity, y, scale }) => (
      <AbsoluteFill style={{ opacity, justifyContent: 'center', alignItems: 'center' }}>
        <GlassPanel style={{ width: 780, transform: `translateY(${y}px) scale(${scale})` }}>
          {['Home', text || 'Feature', 'Share'].map((row, i) => (
            <div
              key={row}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '18px 8px',
                borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.2)' : 'none',
                color: COLORS.cream,
                fontSize: 36,
                fontWeight: 700,
              }}
            >
              <span>{row}</span>
              <span style={{ color: COLORS.blue }}>›</span>
            </div>
          ))}
        </GlassPanel>
      </AbsoluteFill>
    )}
  </EffectShell>
);

export const ChartGrow: React.FC<{
  text?: string | null;
  durationInFrames: number;
  intensity?: number;
}> = ({ text, durationInFrames, intensity = 1 }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity}>
    {({ opacity, frame }) => {
      const h = interpolate(frame, [0, durationInFrames * 0.7], [20, 280], {
        extrapolateRight: 'clamp',
      });
      return (
        <AbsoluteFill style={{ opacity, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 200 }}>
          <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end' }}>
            {[0.45, 0.7, 1].map((m, i) => (
              <div
                key={i}
                style={{
                  width: 72,
                  height: h * m,
                  background: i === 2 ? COLORS.accent : COLORS.lime,
                  borderRadius: 12,
                }}
              />
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <BigType text={(text || 'UP').toUpperCase()} size={64} color={COLORS.cream} />
          </div>
        </AbsoluteFill>
      );
    }}
  </EffectShell>
);

export const OrbitCrop: React.FC<{
  text?: string | null;
  durationInFrames: number;
  intensity?: number;
}> = ({ text, durationInFrames, intensity = 1 }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity}>
    {({ opacity, frame }) => {
      const rot = interpolate(frame, [0, durationInFrames], [0, 25 * intensity]);
      return (
        <AbsoluteFill style={{ opacity, justifyContent: 'center', alignItems: 'center' }}>
          <div
            style={{
              width: 700,
              height: 700,
              borderRadius: 999,
              border: `14px solid ${COLORS.cream}`,
              boxShadow: `0 0 0 18px rgba(0,0,0,0.35)`,
              transform: `rotate(${rot}deg)`,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 48,
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            <BigType text={(text || 'ORBIT').toUpperCase()} size={64} />
          </div>
        </AbsoluteFill>
      );
    }}
  </EffectShell>
);

export const PaperCut: React.FC<{
  text?: string | null;
  durationInFrames: number;
  intensity?: number;
}> = ({ text, durationInFrames, intensity = 1 }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity}>
    {({ opacity, y, scale, frame }) => {
      const shred = interpolate(frame, [0, durationInFrames], [0, 12]);
      return (
        <AbsoluteFill style={{ opacity, justifyContent: 'center', alignItems: 'center' }}>
          <div
            style={{
              background: COLORS.paper,
              padding: '36px 48px',
              transform: `translateY(${y}px) rotate(${-4 + shred * 0.2}deg) scale(${scale})`,
              boxShadow: `8px 12px 0 ${COLORS.ink}`,
              clipPath: `polygon(0 8%, 100% 0, 96% 100%, 4% 92%)`,
            }}
          >
            <BigType text={(text || 'CUT').toUpperCase()} size={84} color={COLORS.ink} />
          </div>
        </AbsoluteFill>
      );
    }}
  </EffectShell>
);

export const DigitalZoom: React.FC<{
  text?: string | null;
  durationInFrames: number;
  intensity?: number;
}> = ({ text, durationInFrames, intensity = 1 }) => (
  <ZoomLike text={text} durationInFrames={durationInFrames} intensity={intensity} accent={COLORS.blue} />
);

export const DoodleBoil: React.FC<{
  text?: string | null;
  emoji?: string | null;
  durationInFrames: number;
  intensity?: number;
}> = ({ text, emoji, durationInFrames, intensity = 1 }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity}>
    {({ opacity, frame }) => {
      const jig = Math.sin(frame / 2) * 6;
      return (
        <AbsoluteFill style={{ opacity, justifyContent: 'flex-start', alignItems: 'flex-end', padding: 64 }}>
          <div
            style={{
              transform: `translate(${jig}px, ${-jig}px) rotate(${jig}deg)`,
              fontSize: 120,
            }}
          >
            {emoji || '✨'}
          </div>
          <div
            style={{
              marginTop: 12,
              border: `4px solid ${COLORS.lime}`,
              padding: '12px 20px',
              borderRadius: 16,
              color: COLORS.lime,
              fontSize: 42,
              fontWeight: 900,
              fontFamily: 'Comic Sans MS, Segoe UI, sans-serif',
              transform: `rotate(${-jig}deg)`,
            }}
          >
            {(text || 'NOTE').toUpperCase()}
          </div>
        </AbsoluteFill>
      );
    }}
  </EffectShell>
);

const ZoomLike: React.FC<{
  text?: string | null;
  durationInFrames: number;
  intensity?: number;
  accent: string;
}> = ({ text, durationInFrames, intensity = 1, accent }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity}>
    {({ opacity, frame }) => {
      const s = interpolate(frame, [0, durationInFrames], [1, 1.15 * intensity]);
      return (
        <AbsoluteFill style={{ opacity, transform: `scale(${s})`, justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ borderBottom: `8px solid ${accent}`, paddingBottom: 8 }}>
            <BigType text={(text || 'ZOOM').toUpperCase()} size={100} color={COLORS.cream} />
          </div>
        </AbsoluteFill>
      );
    }}
  </EffectShell>
);
