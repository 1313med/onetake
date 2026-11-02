import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { EffectShell, BigType } from './shared';
import { COLORS } from '../theme';

/** Visual punch ring + word — plate zoom handled in main composition camera. */
export const ZoomThrough: React.FC<{
  text?: string | null;
  durationInFrames: number;
  intensity?: number;
}> = ({ text, durationInFrames, intensity = 1 }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity}>
    {({ opacity, frame }) => {
      const ring = interpolate(frame, [0, durationInFrames], [0.4, 1.8 * intensity]);
      const ringOp = interpolate(frame, [0, 6, durationInFrames], [0, 0.9, 0], {
        extrapolateRight: 'clamp',
      });
      return (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity }}>
          <div
            style={{
              position: 'absolute',
              width: 520,
              height: 520,
              borderRadius: 999,
              border: `6px solid ${COLORS.accent}`,
              transform: `scale(${ring})`,
              opacity: ringOp,
            }}
          />
          <BigType text={(text || 'NOW').toUpperCase()} size={120} color={COLORS.cream} />
        </AbsoluteFill>
      );
    }}
  </EffectShell>
);
