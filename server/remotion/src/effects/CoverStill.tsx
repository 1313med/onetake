import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile } from 'remotion';
import { EffectShell, BigType } from './shared';
import { COLORS } from '../theme';

/**
 * Photo cutaway when `stillUri` was staged into Remotion public/.
 * Without a still, renders a cinematic cover card (same family as CoverStory).
 */
export const CoverStill: React.FC<{
  text?: string | null;
  line?: string | null;
  stillUri?: string | null;
  assetKey?: string | null;
  emoji?: string | null;
  fullBleed?: boolean;
  durationInFrames: number;
  intensity?: number;
  motion?: string;
}> = ({ text, line, stillUri, durationInFrames, intensity = 1, motion = 'snap' }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity} motion={motion}>
    {({ opacity, scale, frame, y }) => {
      const ken = interpolate(frame, [0, durationInFrames], [1.06, 1.16], {
        extrapolateRight: 'clamp',
      });
      return (
        <AbsoluteFill style={{ opacity, backgroundColor: '#0b0b0f' }}>
          {stillUri ? (
            <AbsoluteFill style={{ transform: `scale(${ken * scale}) translateY(${y * 0.15}px)` }}>
              <Img
                src={
                  stillUri.startsWith('http://') || stillUri.startsWith('https://')
                    ? stillUri
                    : staticFile(stillUri.replace(/^\//, ''))
                }
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </AbsoluteFill>
          ) : (
            <AbsoluteFill
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                background: 'radial-gradient(circle at 50% 40%, #2a2418 0%, #0b0b0f 70%)',
              }}
            >
              <div
                style={{
                  width: 900,
                  padding: 40,
                  border: `8px solid ${COLORS.gold}`,
                  background: COLORS.ink,
                  transform: `translateY(${y}px) scale(${scale})`,
                }}
              >
                <div
                  style={{
                    color: COLORS.gold,
                    letterSpacing: 8,
                    fontSize: 22,
                    marginBottom: 12,
                    fontFamily: 'Arial Black, sans-serif',
                  }}
                >
                  COVER
                </div>
                <BigType text={(text || 'STORY').toUpperCase()} size={88} align="left" color={COLORS.cream} />
              </div>
            </AbsoluteFill>
          )}
          <AbsoluteFill
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, transparent 35%, rgba(0,0,0,0.55) 100%)',
              pointerEvents: 'none',
            }}
          />
          {stillUri ? (
            <AbsoluteFill
              style={{
                justifyContent: 'flex-end',
                alignItems: 'center',
                paddingBottom: 260,
              }}
            >
              <BigType text={(text || 'STORY').toUpperCase()} size={60} color={COLORS.cream} />
              {line ? (
                <div
                  style={{
                    marginTop: 12,
                    maxWidth: '80%',
                    color: COLORS.gold,
                    fontSize: 26,
                    fontWeight: 700,
                    textAlign: 'center',
                    fontFamily: 'Segoe UI, Tahoma, sans-serif',
                    direction: /[\u0600-\u06FF]/.test(line) ? 'rtl' : 'ltr',
                  }}
                >
                  {String(line).slice(0, 72)}
                </div>
              ) : null}
            </AbsoluteFill>
          ) : null}
        </AbsoluteFill>
      );
    }}
  </EffectShell>
);
