import React from 'react';
import { AbsoluteFill, interpolate, spring, useVideoConfig } from 'remotion';
import { EffectShell, GlassPanel } from './shared';
import { COLORS } from '../theme';

const FALLBACK = ['Point one', 'Point two', 'Point three'];

export const Checklist: React.FC<{
  text?: string | null;
  line?: string | null;
  durationInFrames: number;
  intensity?: number;
  motion?: string;
}> = ({ text, line, durationInFrames, intensity = 1, motion = 'snap' }) => {
  const { fps } = useVideoConfig();
  const fromLine = line
    ? line
        .split(/[·|,،\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
  const items = [text || 'Hook', ...fromLine, ...FALLBACK].filter(Boolean).slice(0, 3);

  return (
    <EffectShell durationInFrames={durationInFrames} intensity={intensity} motion={motion}>
      {({ opacity, y, scale, frame }) => (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            opacity,
            transform: `translateY(${y}px) scale(${scale})`,
            background: 'radial-gradient(circle at 50% 40%, #14201a 0%, #0b0b0f 70%)',
          }}
        >
          <GlassPanel style={{ width: 900, background: 'rgba(8,12,14,0.72)' }}>
            <div
              style={{
                color: COLORS.lime,
                fontWeight: 900,
                fontSize: 30,
                marginBottom: 24,
                fontFamily: 'Arial Black, sans-serif',
                letterSpacing: 2,
              }}
            >
              CHECKLIST
            </div>
            {items.map((item, i) => {
              const local = spring({
                frame: frame - i * 9,
                fps,
                config: { damping: 13, stiffness: 140 },
              });
              const check = interpolate(frame - i * 11, [0, 10], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const flash = interpolate(frame - i * 11, [8, 14, 22], [0, 1, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              return (
                <div
                  key={`${item}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                    marginBottom: 20,
                    transform: `translateX(${(1 - local) * 48}px)`,
                    opacity: local,
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      border: `3px solid ${COLORS.lime}`,
                      background: check > 0.5 ? COLORS.lime : 'transparent',
                      boxShadow: flash > 0 ? `0 0 ${24 * flash}px ${COLORS.lime}` : undefined,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: COLORS.ink,
                      fontWeight: 900,
                      fontSize: 30,
                    }}
                  >
                    {check > 0.5 ? '✓' : ''}
                  </div>
                  <div
                    style={{
                      color: COLORS.cream,
                      fontSize: 42,
                      fontWeight: 800,
                      fontFamily: 'Segoe UI, Tahoma, sans-serif',
                      direction: /[\u0600-\u06FF]/.test(String(item)) ? 'rtl' : 'ltr',
                      flex: 1,
                    }}
                  >
                    {String(item).slice(0, 32)}
                  </div>
                </div>
              );
            })}
          </GlassPanel>
        </AbsoluteFill>
      )}
    </EffectShell>
  );
};
