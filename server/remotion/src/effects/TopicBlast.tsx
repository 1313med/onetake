import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from '../theme';

/**
 * Full-bleed kinetic topic plate — ALWAYS opaque.
 * Used for cutaways so we never show empty black frames.
 */
export const TopicBlast: React.FC<{
  text?: string | null;
  line?: string | null;
  emoji?: string | null;
  durationInFrames: number;
  intensity?: number;
  motion?: string;
  accent?: string;
}> = ({
  text,
  line,
  emoji,
  durationInFrames,
  intensity = 1,
  motion = 'slam',
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = String(text || 'LISTEN').toUpperCase();
  const sub = String(line || '').trim();
  const enter = spring({
    frame,
    fps,
    config: { damping: motion === 'slam' ? 12 : 16, stiffness: motion === 'slam' ? 200 : 140, mass: 0.6 },
  });
  const scale = interpolate(enter, [0, 1], [motion === 'slam' ? 1.45 : 0.85, 1]);
  const opacity = interpolate(frame, [0, 4, durationInFrames - 6, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const spin = interpolate(frame, [0, durationInFrames], [0, 12 * intensity]);
  const accentColor = accent || COLORS.accent;

  return (
    <AbsoluteFill
      style={{
        opacity,
        background: `radial-gradient(circle at 30% 25%, ${accentColor}55 0%, #120810 42%, #050508 100%)`,
      }}
    >
      {/* kinetic bars */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: -40,
            top: 180 + i * 140,
            width: '140%',
            height: 18,
            background: i % 2 ? COLORS.gold : accentColor,
            opacity: 0.14,
            transform: `rotate(${-8 + spin * 0.2}deg)`,
          }}
        />
      ))}

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: 48,
          transform: `scale(${scale})`,
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 920 }}>
          <div
            style={{
              fontSize: 120,
              marginBottom: 18,
              filter: 'drop-shadow(0 18px 30px rgba(0,0,0,0.45))',
            }}
          >
            {emoji || '💥'}
          </div>
          <div
            style={{
              display: 'inline-block',
              background: accentColor,
              color: COLORS.cream,
              fontWeight: 900,
              fontSize: 26,
              letterSpacing: 4,
              padding: '10px 18px',
              borderRadius: 10,
              fontFamily: 'Arial Black, Impact, sans-serif',
              marginBottom: 22,
            }}
          >
            KEY MOMENT
          </div>
          <div
            style={{
              color: COLORS.cream,
              fontSize: Math.min(108, Math.max(64, 920 / Math.max(4, title.length))),
              fontWeight: 900,
              fontFamily: 'Arial Black, Impact, sans-serif',
              letterSpacing: -2,
              lineHeight: 0.95,
              textShadow: `0 8px 0 #000, 0 0 40px ${accentColor}88`,
              wordBreak: 'break-word',
            }}
          >
            {title}
          </div>
          {sub ? (
            <div
              style={{
                marginTop: 28,
                color: COLORS.gold,
                fontSize: 34,
                fontWeight: 800,
                fontFamily: 'Segoe UI, Tahoma, sans-serif',
                lineHeight: 1.25,
                textShadow: '0 3px 10px rgba(0,0,0,0.6)',
                direction: /[\u0600-\u06FF]/.test(sub) ? 'rtl' : 'ltr',
              }}
            >
              {sub.slice(0, 90)}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
