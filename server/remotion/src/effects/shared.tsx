import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from '../theme';

export const fadeSlide = (frame: number, dur: number, intensity = 1) => {
  const enter = Math.min(8, Math.floor(dur * 0.22));
  const exit = Math.min(6, Math.floor(dur * 0.18));
  const opacity = interpolate(frame, [0, enter, Math.max(enter + 1, dur - exit), dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [0, enter], [36 * intensity, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame, [0, enter, enter + 4], [0.82, 1.06, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { opacity, y, scale };
};

/** Snap / slam / bounce motion presets for pro UGC plates. */
export const motionPreset = (
  frame: number,
  dur: number,
  motion: string | undefined,
  intensity = 1,
  fps = 30
) => {
  const m = motion || 'snap';
  if (m === 'slam') {
    const s = spring({
      frame,
      fps,
      config: { damping: 11, stiffness: 220, mass: 0.55 },
    });
    const scale = interpolate(s, [0, 1], [1.55 * intensity, 1]);
    const rot = interpolate(s, [0, 1], [-14, 0]);
    const opacity = interpolate(frame, [0, 3, dur - 5, dur], [0, 1, 1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return { opacity, y: 0, scale, rot };
  }
  if (m === 'bounce') {
    const s = spring({
      frame,
      fps,
      config: { damping: 9, stiffness: 160, mass: 0.7 },
    });
    return {
      opacity: interpolate(frame, [0, 4, dur - 6, dur], [0, 1, 1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
      y: interpolate(s, [0, 1], [50 * intensity, 0]),
      scale: interpolate(s, [0, 1], [0.7, 1]),
      rot: 0,
    };
  }
  if (m === 'spin') {
    const rot = interpolate(frame, [0, dur], [0, 40], { extrapolateRight: 'clamp' });
    const base = fadeSlide(frame, dur, intensity);
    return { ...base, rot };
  }
  // snap default
  const base = fadeSlide(frame, dur, intensity);
  return { ...base, rot: 0 };
};

export const BigType: React.FC<{
  text: string;
  color?: string;
  size?: number;
  align?: 'left' | 'center' | 'right';
  rtl?: boolean;
}> = ({ text, color = COLORS.cream, size = 92, align = 'center', rtl }) => (
  <div
    style={{
      color,
      fontSize: size,
      fontWeight: 900,
      letterSpacing: -1.5,
      textAlign: align,
      lineHeight: 1.05,
      fontFamily: 'Arial Black, Impact, system-ui, sans-serif',
      direction: rtl ? 'rtl' : 'ltr',
      textShadow: `0 6px 0 ${COLORS.shadow}`,
      wordBreak: 'break-word',
      maxWidth: '92%',
    }}
  >
    {text}
  </div>
);

export const GlassPanel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <div
    style={{
      background: COLORS.glass,
      border: `2px solid ${COLORS.glassBorder}`,
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      borderRadius: 28,
      padding: '28px 32px',
      boxShadow: `0 20px 50px ${COLORS.shadow}`,
      ...style,
    }}
  >
    {children}
  </div>
);

export const EffectShell: React.FC<{
  durationInFrames: number;
  intensity?: number;
  motion?: string;
  children: (anim: {
    opacity: number;
    y: number;
    scale: number;
    rot: number;
    frame: number;
  }) => React.ReactNode;
}> = ({ durationInFrames, intensity = 1, motion, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const anim = { ...motionPreset(frame, durationInFrames, motion, intensity, fps), frame };
  return <AbsoluteFill style={{ pointerEvents: 'none' }}>{children(anim)}</AbsoluteFill>;
};

export const FlashSmash: React.FC<{ frames?: number }> = ({ frames = 4 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 1, frames], [0.85, 0.35, 0], {
    extrapolateRight: 'clamp',
  });
  if (frame > frames) return null;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#fff',
        opacity,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}
    />
  );
};
