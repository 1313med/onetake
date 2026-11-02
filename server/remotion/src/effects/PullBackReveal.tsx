import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { EffectShell, BigType, GlassPanel } from './shared';
import { COLORS } from '../theme';

export const PullBackReveal: React.FC<{
  text?: string | null;
  line?: string | null;
  durationInFrames: number;
  intensity?: number;
}> = ({ text, line, durationInFrames, intensity = 1 }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity}>
    {({ opacity, frame }) => {
      const reveal = interpolate(frame, [0, Math.min(20, durationInFrames * 0.4)], [1.35, 1], {
        extrapolateRight: 'clamp',
      });
      const veil = interpolate(frame, [0, 15, durationInFrames], [0.55, 0.25, 0.1], {
        extrapolateRight: 'clamp',
      });
      return (
        <AbsoluteFill style={{ opacity, transform: `scale(${reveal})` }}>
          <AbsoluteFill style={{ background: `rgba(0,0,0,${veil})` }} />
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 160 }}>
            <GlassPanel>
              <BigType text={(text || 'REVEAL').toUpperCase()} size={78} color={COLORS.gold} />
              {line ? (
                <div
                  style={{
                    marginTop: 12,
                    color: COLORS.cream,
                    fontSize: 30,
                    textAlign: 'center',
                    direction: 'rtl',
                    maxWidth: 700,
                  }}
                >
                  {line.slice(0, 70)}
                </div>
              ) : null}
            </GlassPanel>
          </AbsoluteFill>
        </AbsoluteFill>
      );
    }}
  </EffectShell>
);
