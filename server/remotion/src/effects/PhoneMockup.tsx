import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { EffectShell } from './shared';
import { COLORS } from '../theme';

const FIELDS = [
  { label: 'Country', value: 'Ireland' },
  { label: 'Type', value: 'Visa' },
  { label: 'Status', value: 'Draft' },
];

export const PhoneMockup: React.FC<{
  text?: string | null;
  line?: string | null;
  durationInFrames: number;
  intensity?: number;
  motion?: string;
}> = ({ text, line, durationInFrames, intensity = 1, motion = 'snap' }) => (
  <EffectShell durationInFrames={durationInFrames} intensity={intensity} motion={motion}>
    {({ opacity, frame, scale, rot }) => {
      const floatY = interpolate(frame, [0, durationInFrames / 2, durationInFrames], [28, -8, 16]);
      const cursorOn = Math.floor(frame / 8) % 2 === 0;
      const typedChars = Math.min(
        String(line || text || 'Application').length,
        Math.floor(interpolate(frame, [8, Math.max(20, durationInFrames * 0.7)], [0, 40], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }))
      );
      const typed = String(line || text || 'Application').slice(0, typedChars);

      return (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            opacity,
            background: 'radial-gradient(circle at 50% 30%, #1a2744 0%, #07070c 65%)',
          }}
        >
          <div
            style={{
              width: 460,
              height: 860,
              borderRadius: 52,
              background: '#0c0c10',
              border: '12px solid #1c1c22',
              boxShadow: `0 40px 100px ${COLORS.shadow}`,
              transform: `translateY(${floatY}px) rotate(${rot * 0.35}deg) scale(${scale})`,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 130,
                height: 30,
                borderRadius: 20,
                background: '#000',
              }}
            />
            <div
              style={{
                marginTop: 64,
                padding: '24px 26px',
                height: '100%',
                background: 'linear-gradient(165deg, #12203a, #0b1224 55%, #101820)',
                color: COLORS.cream,
              }}
            >
              <div style={{ fontSize: 20, opacity: 0.65, marginBottom: 8 }}>Form · Secure</div>
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 900,
                  lineHeight: 1.1,
                  fontFamily: 'Arial Black, sans-serif',
                  color: COLORS.gold,
                  marginBottom: 22,
                }}
              >
                {(text || 'VISA').toUpperCase()}
              </div>
              {FIELDS.map((f, i) => {
                const show = frame > 6 + i * 7;
                return (
                  <div
                    key={f.label}
                    style={{
                      marginBottom: 14,
                      opacity: show ? 1 : 0.15,
                      transform: `translateY(${show ? 0 : 12}px)`,
                    }}
                  >
                    <div style={{ fontSize: 18, opacity: 0.55, marginBottom: 6 }}>{f.label}</div>
                    <div
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: `1px solid rgba(255,255,255,0.18)`,
                        borderRadius: 12,
                        padding: '14px 16px',
                        fontSize: 28,
                        fontWeight: 700,
                        fontFamily: 'Segoe UI, Tahoma, sans-serif',
                      }}
                    >
                      {f.value}
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 18, opacity: 0.55, marginBottom: 6 }}>Notes</div>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    fontSize: 26,
                    minHeight: 72,
                    fontFamily: 'Segoe UI, Tahoma, sans-serif',
                    direction: /[\u0600-\u06FF]/.test(typed) ? 'rtl' : 'ltr',
                  }}
                >
                  {typed}
                  <span style={{ opacity: cursorOn ? 1 : 0, color: COLORS.lime }}>|</span>
                </div>
              </div>
              <div
                style={{
                  marginTop: 28,
                  background: COLORS.lime,
                  color: COLORS.ink,
                  textAlign: 'center',
                  fontWeight: 900,
                  fontSize: 28,
                  padding: '16px 12px',
                  borderRadius: 16,
                  fontFamily: 'Arial Black, sans-serif',
                }}
              >
                CONTINUE
              </div>
            </div>
          </div>
        </AbsoluteFill>
      );
    }}
  </EffectShell>
);
