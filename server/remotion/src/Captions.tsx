import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion';
import type { CaptionCue } from './types';
import { COLORS } from './theme';

const LATIN_RE = /[A-Za-z]/;
const ARABIC_RE = /[\u0600-\u06FF]/;

const EMPHASIS = new Set(
  [
    'free',
    'platform',
    'website',
    'community',
    'job',
    'offer',
    'visa',
    'ireland',
    'tacos',
    'marketing',
    'new',
    'join',
    'register',
    'wave',
    'internet',
    'search',
    'lyon',
  ].map((w) => w.toLowerCase())
);

const styleFor = (captionStyle: string, english: boolean) => {
  switch (captionStyle) {
    case 'documentary':
      return {
        size: english ? 52 : 44,
        weight: 800,
        color: COLORS.cream,
        bg: 'rgba(0,0,0,0.62)',
        radius: 12,
        padBottom: 210,
        center: false,
      };
    case 'cinematic':
      return {
        size: english ? 56 : 50,
        weight: 800,
        color: COLORS.cream,
        bg: 'rgba(12,8,0,0.5)',
        radius: 10,
        padBottom: 220,
        center: false,
      };
    case 'kinetic':
      return {
        size: 64,
        weight: 900,
        color: COLORS.lime,
        bg: 'rgba(0,0,0,0.72)',
        radius: 16,
        padBottom: 0,
        center: true,
      };
    default:
      return {
        size: english ? 62 : 56,
        weight: 900,
        color: COLORS.cream,
        bg: english ? 'rgba(0,0,0,0.78)' : 'rgba(255,59,92,0.9)',
        radius: 16,
        padBottom: 0,
        center: true,
      };
  }
};

function isEmphasis(part: string, hybridMode: boolean) {
  const clean = part.replace(/[^\p{L}\p{N}'-]/gu, '');
  if (!clean) return false;
  if (hybridMode) {
    return LATIN_RE.test(clean) && !ARABIC_RE.test(clean);
  }
  if (EMPHASIS.has(clean.toLowerCase())) return true;
  if (/^[A-Z]{2,}$/.test(clean)) return true;
  return false;
}

function renderCaptionText(text: string, baseColor: string, baseSize: number, hybridMode: boolean) {
  const parts = String(text || '').split(/(\s+)/);
  return parts.map((part, i) => {
    const hot = isEmphasis(part, hybridMode);
    return (
      <span
        key={`${i}-${part}`}
        style={{
          color: hot ? COLORS.gold : baseColor,
          fontWeight: hot ? 900 : undefined,
          fontSize: hot ? baseSize * 1.12 : baseSize,
          direction: LATIN_RE.test(part) && !ARABIC_RE.test(part) ? 'ltr' : undefined,
          unicodeBidi: LATIN_RE.test(part) && !ARABIC_RE.test(part) ? 'embed' : undefined,
          textShadow: hot ? `0 0 16px rgba(245,197,66,0.4)` : undefined,
        }}
      >
        {part}
      </span>
    );
  });
}

const PopCaption: React.FC<{
  text: string;
  captionStyle: string;
  lang?: string;
}> = ({ text, captionStyle, lang }) => {
  const frame = useCurrentFrame();
  const hasArabic = ARABIC_RE.test(text || '') || lang === 'ar';
  const english = !hasArabic;
  const st = styleFor(captionStyle, english);
  const scale = interpolate(frame, [0, 2, 6], [0.78, 1.12, 1], {
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(frame, [0, 2], [0, 1], { extrapolateRight: 'clamp' });
  const y = interpolate(frame, [0, 5], [18, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        justifyContent: st.center ? 'center' : 'flex-end',
        alignItems: 'center',
        paddingBottom: st.center ? 160 : st.padBottom,
        paddingTop: st.center ? 40 : 0,
        zIndex: 20,
      }}
    >
      <div
        style={{
          maxWidth: '92%',
          padding: english ? '18px 28px' : '16px 26px',
          background: st.bg,
          borderRadius: st.radius,
          color: st.color,
          fontWeight: st.weight,
          textAlign: 'center',
          lineHeight: 1.15,
          fontFamily: 'Arial Black, Impact, Segoe UI, Tahoma, sans-serif',
          direction: hasArabic ? 'rtl' : 'ltr',
          textShadow: '0 4px 12px rgba(0,0,0,0.65)',
          transform: `translateY(${y}px) scale(${scale})`,
          opacity,
          boxShadow: '0 14px 40px rgba(0,0,0,0.4)',
          border: english ? '2px solid rgba(255,255,255,0.12)' : undefined,
          letterSpacing: english ? -0.5 : undefined,
        }}
      >
        {renderCaptionText(text, st.color, st.size, hasArabic)}
      </div>
    </AbsoluteFill>
  );
};

export const Captions: React.FC<{
  captions: CaptionCue[];
  captionStyle: string;
  fps: number;
}> = ({ captions, captionStyle, fps }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 30 }}>
      {captions.map((c, i) => {
        const span = Math.max(0, (c.end || 0) - (c.start || 0));
        if (span < 0.25) return null;
        const from = Math.max(0, Math.floor(c.start * fps));
        const dur = Math.max(2, Math.floor(span * fps));
        return (
          <Sequence key={`cap-${i}-${from}`} from={from} durationInFrames={dur} layout="none">
            <PopCaption text={c.text} captionStyle={c.style || captionStyle} lang={c.lang} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
