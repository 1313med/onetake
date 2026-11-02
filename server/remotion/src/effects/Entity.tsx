import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { BigType, EffectShell } from './shared';
import { COLORS } from '../theme';

export const BrandCard: React.FC<{
  text?: string | null;
  emoji?: string | null;
  durationInFrames: number;
  intensity?: number;
  motion?: string;
}> = ({ text, emoji, durationInFrames, intensity = 1, motion = 'snap' }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity} motion={motion}>
    {({ opacity, y, scale, frame, rot }) => {
      const glow = interpolate(frame, [0, durationInFrames], [0.4, 1]);
      return (
        <AbsoluteFill
          style={{
            opacity,
            justifyContent: 'center',
            alignItems: 'center',
            background: 'radial-gradient(circle at 50% 45%, #2a1a10 0%, #0b0b0f 70%)',
          }}
        >
          <div
            style={{
              transform: `translateY(${y}px) scale(${scale}) rotate(${rot * 0.2}deg)`,
              width: 860,
              borderRadius: 32,
              padding: '44px 44px',
              background: `linear-gradient(145deg, #141414 0%, #1a1a1a 55%, #2a1810 ${glow * 100}%)`,
              border: `5px solid ${COLORS.gold}`,
              boxShadow: `0 28px 70px ${COLORS.shadow}, 0 0 40px rgba(245,197,66,0.25)`,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 88, marginBottom: 14 }}>{emoji || '🏷️'}</div>
            <BigType text={(text || 'BRAND').toUpperCase()} size={68} color={COLORS.cream} />
            <div
              style={{
                marginTop: 16,
                color: COLORS.gold,
                letterSpacing: 5,
                fontSize: 24,
                fontWeight: 800,
                fontFamily: 'Arial Black, sans-serif',
              }}
            >
              MENTIONED
            </div>
          </div>
        </AbsoluteFill>
      );
    }}
  </EffectShell>
);

export const FoodPop: React.FC<{
  text?: string | null;
  emoji?: string | null;
  durationInFrames: number;
  intensity?: number;
  motion?: string;
}> = ({ text, emoji, durationInFrames, intensity = 1, motion = 'bounce' }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity} motion={motion}>
    {({ opacity, frame, scale }) => {
      const bounce = interpolate(frame, [0, 7, 16, 24], [0.55, 1.18, 0.94, 1], {
        extrapolateRight: 'clamp',
      });
      return (
        <AbsoluteFill
          style={{
            opacity,
            justifyContent: 'center',
            alignItems: 'center',
            background: 'radial-gradient(circle at 50% 40%, #3a1810 0%, #0b0b0f 68%)',
          }}
        >
          <div style={{ transform: `scale(${bounce * scale})`, textAlign: 'center' }}>
            <div style={{ fontSize: 180, filter: 'drop-shadow(0 16px 24px rgba(0,0,0,0.45))' }}>
              {emoji || '🌮'}
            </div>
            <div
              style={{
                marginTop: 12,
                display: 'inline-block',
                background: COLORS.accent,
                color: COLORS.cream,
                fontWeight: 900,
                fontSize: 64,
                padding: '14px 34px',
                borderRadius: 18,
                fontFamily: 'Arial Black, sans-serif',
                letterSpacing: -1,
                boxShadow: `0 12px 0 ${COLORS.ink}`,
              }}
            >
              {(text || 'TACOS').toUpperCase()}
            </div>
          </div>
        </AbsoluteFill>
      );
    }}
  </EffectShell>
);

export const FreeBurst: React.FC<{
  text?: string | null;
  line?: string | null;
  durationInFrames: number;
  intensity?: number;
  motion?: string;
}> = ({ text, line, durationInFrames, intensity = 1, motion = 'slam' }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity} motion={motion}>
    {({ opacity, frame, scale }) => {
      const spin = interpolate(frame, [0, durationInFrames], [0, 55]);
      const rays = interpolate(frame, [0, 10, durationInFrames], [0.7, 1.25, 1.05], {
        extrapolateRight: 'clamp',
      });
      const wordScale = interpolate(frame, [0, 6, 14], [0.4, 1.2, 1], {
        extrapolateRight: 'clamp',
      });
      return (
        <AbsoluteFill
          style={{
            opacity,
            justifyContent: 'center',
            alignItems: 'center',
            background: 'radial-gradient(circle at 50% 45%, #3a2a00 0%, #0b0b0f 65%)',
          }}
        >
          <div style={{ position: 'relative', textAlign: 'center', transform: `scale(${scale})` }}>
            {[0, 30, 60, 90, 120, 150].map((deg) => (
              <div
                key={deg}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 6,
                  height: 160 * rays,
                  background: `linear-gradient(180deg, ${COLORS.gold}, transparent)`,
                  transform: `translate(-50%, -50%) rotate(${deg + spin}deg)`,
                  opacity: 0.65,
                  borderRadius: 4,
                }}
              />
            ))}
            <div
              style={{
                fontSize: 140,
                fontWeight: 900,
                color: COLORS.gold,
                fontFamily: 'Arial Black, Impact, sans-serif',
                textShadow: `0 10px 0 ${COLORS.ink}, 0 0 40px rgba(245,197,66,0.5)`,
                letterSpacing: -4,
                position: 'relative',
                transform: `scale(${wordScale})`,
              }}
            >
              {(text || 'FREE').toUpperCase()}
            </div>
            <div
              style={{
                marginTop: 22,
                display: 'inline-block',
                background: COLORS.lime,
                color: COLORS.ink,
                fontWeight: 900,
                fontSize: 40,
                padding: '12px 26px',
                borderRadius: 999,
                fontFamily: 'Segoe UI, Tahoma, sans-serif',
                boxShadow: `0 8px 0 rgba(0,0,0,0.35)`,
                position: 'relative',
              }}
            >
              {line?.includes('فابور') ? 'فابور' : 'فابور · FREE'}
            </div>
          </div>
        </AbsoluteFill>
      );
    }}
  </EffectShell>
);
