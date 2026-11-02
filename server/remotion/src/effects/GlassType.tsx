import React from 'react';
import { AbsoluteFill } from 'remotion';
import { BigType, EffectShell, GlassPanel } from './shared';
import { COLORS } from '../theme';

export const GlassType: React.FC<{
  text?: string | null;
  line?: string | null;
  durationInFrames: number;
  intensity?: number;
}> = ({ text, line, durationInFrames, intensity = 1 }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity}>
    {({ opacity, y, scale }) => (
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          opacity,
          transform: `translateY(${y}px) scale(${scale})`,
        }}
      >
        <GlassPanel style={{ maxWidth: 900 }}>
          <BigType text={(text || 'LISTEN').toUpperCase()} size={88} rtl color={COLORS.cream} />
          {line ? (
            <div
              style={{
                marginTop: 18,
                color: 'rgba(255,255,255,0.85)',
                fontSize: 34,
                fontWeight: 600,
                textAlign: 'center',
                direction: 'rtl',
                fontFamily: 'Segoe UI, Tahoma, sans-serif',
              }}
            >
              {line.slice(0, 60)}
            </div>
          ) : null}
        </GlassPanel>
      </AbsoluteFill>
    )}
  </EffectShell>
);
