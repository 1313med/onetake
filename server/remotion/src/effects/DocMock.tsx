import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { EffectShell } from './shared';
import { COLORS } from '../theme';

export const DocMock: React.FC<{
  text?: string | null;
  line?: string | null;
  durationInFrames: number;
  intensity?: number;
  motion?: string;
}> = ({ text, line, durationInFrames, intensity = 1, motion = 'snap' }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity} motion={motion}>
    {({ opacity, y, scale, frame }) => {
      const slide = interpolate(frame, [0, 12], [80, 0], { extrapolateRight: 'clamp' });
      const highlight = interpolate(frame, [10, 28], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      return (
        <AbsoluteFill
          style={{
            opacity,
            justifyContent: 'center',
            alignItems: 'center',
            background: 'radial-gradient(circle at 50% 40%, #2a241c 0%, #0b0b0f 70%)',
          }}
        >
          <div
            style={{
              transform: `translateY(${y + slide}px) scale(${scale})`,
              width: 780,
              minHeight: 980,
              background: COLORS.paper,
              borderRadius: 12,
              padding: '48px 44px',
              boxShadow: `0 40px 80px ${COLORS.shadow}`,
              position: 'relative',
            }}
          >
            <div
              style={{
                height: 18,
                width: '55%',
                background: '#d4c4a8',
                borderRadius: 4,
                marginBottom: 28,
              }}
            />
            {[0.9, 0.75, 0.85, 0.6, 0.8].map((w, i) => (
              <div
                key={i}
                style={{
                  height: 14,
                  width: `${w * 100}%`,
                  background: i === 2 ? `rgba(245,197,66,${0.35 + highlight * 0.5})` : '#e8dcc8',
                  borderRadius: 3,
                  marginBottom: 16,
                  outline: i === 2 ? `2px solid ${COLORS.gold}` : undefined,
                }}
              />
            ))}
            <div
              style={{
                marginTop: 48,
                padding: '20px 24px',
                border: `3px dashed ${COLORS.ink}`,
                borderRadius: 10,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 900,
                  fontFamily: 'Arial Black, sans-serif',
                  color: COLORS.ink,
                  letterSpacing: 2,
                }}
              >
                {(text || 'DOCUMENT').toUpperCase()}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 26,
                  color: '#5a4e3a',
                  fontFamily: 'Segoe UI, Tahoma, sans-serif',
                  direction: 'rtl',
                }}
              >
                {(line || '').slice(0, 60)}
              </div>
            </div>
            <div
              style={{
                position: 'absolute',
                right: 36,
                bottom: 40,
                width: 120,
                height: 120,
                borderRadius: 999,
                border: `4px solid ${COLORS.accent}`,
                opacity: 0.55 + highlight * 0.4,
                transform: `rotate(-18deg) scale(${0.85 + highlight * 0.2})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: COLORS.accent,
                fontWeight: 900,
                fontSize: 18,
                fontFamily: 'Arial Black, sans-serif',
              }}
            >
              OK
            </div>
          </div>
        </AbsoluteFill>
      );
    }}
  </EffectShell>
);
