import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { EffectShell } from './shared';
import { COLORS } from '../theme';

export const StampSlam: React.FC<{
  text?: string | null;
  durationInFrames: number;
  intensity?: number;
  motion?: string;
}> = ({ text, durationInFrames, intensity = 1, motion = 'slam' }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity} motion={motion}>
    {({ opacity, scale, rot, frame }) => {
      const ink = interpolate(frame, [4, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      return (
        <AbsoluteFill style={{ opacity, justifyContent: 'center', alignItems: 'center' }}>
          <div
            style={{
              transform: `rotate(${rot - 12}deg) scale(${scale})`,
              border: `10px solid ${COLORS.accent}`,
              borderRadius: 18,
              padding: '28px 48px',
              background: `rgba(255,59,92,${0.12 + ink * 0.15})`,
              boxShadow: `0 0 0 ${8 * ink}px rgba(255,59,92,0.25)`,
            }}
          >
            <div
              style={{
                color: COLORS.accent,
                fontSize: 72,
                fontWeight: 900,
                fontFamily: 'Arial Black, Impact, sans-serif',
                letterSpacing: 4,
                textTransform: 'uppercase',
              }}
            >
              {text || 'APPROVED'}
            </div>
          </div>
        </AbsoluteFill>
      );
    }}
  </EffectShell>
);
