import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { EffectShell } from './shared';
import { COLORS } from '../theme';

export const FrameBreak: React.FC<{
  text?: string | null;
  durationInFrames: number;
  intensity?: number;
}> = ({ text, durationInFrames, intensity = 1 }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity}>
    {({ opacity, frame, scale }) => {
      const tilt = interpolate(frame, [0, durationInFrames], [-3, 4]);
      return (
        <AbsoluteFill style={{ opacity, justifyContent: 'center', alignItems: 'center' }}>
          {/* Polaroid / magazine frame overlay — plate shows through center via cutout feel */}
          <div
            style={{
              width: 820,
              height: 1100,
              background: COLORS.paper,
              borderRadius: 18,
              padding: 28,
              boxShadow: `0 40px 100px ${COLORS.shadow}`,
              transform: `rotate(${tilt}deg) scale(${scale})`,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                flex: 1,
                borderRadius: 8,
                border: `4px dashed rgba(0,0,0,0.15)`,
                background: 'rgba(0,0,0,0.05)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  boxShadow: 'inset 0 0 0 9999px rgba(255, 120, 40, 0.12)',
                }}
              />
            </div>
            <div
              style={{
                marginTop: 22,
                fontFamily: 'Georgia, serif',
                fontSize: 42,
                fontWeight: 700,
                color: COLORS.ink,
                textAlign: 'center',
                direction: 'rtl',
              }}
            >
              {(text || 'COVER').toUpperCase()}
            </div>
            <div
              style={{
                marginTop: 6,
                textAlign: 'center',
                fontSize: 22,
                letterSpacing: 4,
                color: 'rgba(0,0,0,0.45)',
                fontFamily: 'Arial, sans-serif',
              }}
            >
              AFTER EDIT
            </div>
          </div>
        </AbsoluteFill>
      );
    }}
  </EffectShell>
);
