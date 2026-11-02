import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { BigType, EffectShell } from './shared';
import { COLORS } from '../theme';

export const HeadlineWall: React.FC<{
  text?: string | null;
  durationInFrames: number;
  intensity?: number;
}> = ({ text, durationInFrames, intensity = 1 }) => {
  const word = (text || 'HOOK').toUpperCase();
  return (
    <EffectShell durationInFrames={durationInFrames} intensity={intensity}>
      {({ opacity, frame }) => {
        const drift = interpolate(frame, [0, durationInFrames], [0, -40 * intensity]);
        return (
          <AbsoluteFill style={{ opacity }}>
            <AbsoluteFill
              style={{
                justifyContent: 'flex-end',
                padding: 48,
                background: `linear-gradient(180deg, transparent 35%, rgba(0,0,0,0.72) 100%)`,
              }}
            >
              <div style={{ transform: `translateY(${drift}px)` }}>
                <div
                  style={{
                    display: 'inline-block',
                    background: COLORS.accent,
                    color: COLORS.cream,
                    fontWeight: 900,
                    fontSize: 28,
                    padding: '8px 16px',
                    borderRadius: 8,
                    marginBottom: 16,
                    fontFamily: 'Arial Black, sans-serif',
                  }}
                >
                  ONE TAKE
                </div>
                <BigType text={word} size={110} align="left" />
              </div>
            </AbsoluteFill>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: 120 + i * 70,
                  right: -20,
                  opacity: 0.12,
                  transform: `rotate(90deg) translateY(${drift * 0.3}px)`,
                  color: COLORS.cream,
                  fontSize: 64,
                  fontWeight: 900,
                  whiteSpace: 'nowrap',
                  fontFamily: 'Arial Black, sans-serif',
                }}
              >
                {word} · {word}
              </div>
            ))}
          </AbsoluteFill>
        );
      }}
    </EffectShell>
  );
};
