import {
  setAudioModeAsync,
  useAudioPlayer,
} from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import type { Variant } from '../types';
import { colors, radii } from '../theme';

type Props = {
  uri: string;
  variant?: Variant;
  compact?: boolean;
  withAudio?: boolean;
};

const overlayColor: Record<Variant['overlayStyle'], string> = {
  bold: 'rgba(0,0,0,0.22)',
  minimal: 'rgba(0,0,0,0.08)',
  lyric: 'rgba(20,10,40,0.3)',
  bilingual: 'rgba(0,20,30,0.22)',
  neon: 'rgba(255,77,109,0.14)',
};

/**
 * Remount when source/variant changes so expo-video gets a fresh player.
 */
export function VideoPreview(props: Props) {
  return <VideoPreviewInner key={`${props.uri}::${props.variant?.id ?? 'raw'}`} {...props} />;
}

function VideoPreviewInner({ uri, variant, compact, withAudio = true }: Props) {
  const edit = variant?.edit;
  const [captionIndex, setCaptionIndex] = useState(0);
  const [showHook, setShowHook] = useState(true);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = !edit;
    p.muted = edit?.muteOriginal ?? false;
    p.playbackRate = edit?.rate ?? 1;
    p.preservesPitch = true;
    p.play();
  });

  const musicUrl = withAudio && edit?.musicUrl ? edit.musicUrl : null;
  const music = useAudioPlayer(musicUrl ?? undefined);

  // Apply edit recipe + music
  useEffect(() => {
    let cancelled = false;
    let jumpTimer: ReturnType<typeof setInterval> | undefined;
    let captionTimer: ReturnType<typeof setInterval> | undefined;
    let hookTimer: ReturnType<typeof setTimeout> | undefined;
    let loopTimer: ReturnType<typeof setInterval> | undefined;

    const run = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'mixWithOthers',
        });
      } catch {
        /* ignore */
      }

      setCaptionIndex(0);
      setShowHook(true);

      try {
        player.muted = edit?.muteOriginal ?? false;
        player.playbackRate = edit?.rate ?? 1;
        player.loop = !edit;
        if (edit) {
          player.currentTime = edit.startMs / 1000;
        } else {
          player.currentTime = 0;
        }
        player.play();
      } catch {
        /* ignore */
      }

      if (musicUrl) {
        try {
          music.replace(musicUrl);
          music.loop = true;
          music.volume = edit?.musicVolume ?? 0.45;
          music.play();
        } catch {
          /* CDN / network may fail — video edit still works */
        }
      } else {
        try {
          music.pause();
        } catch {
          /* ignore */
        }
      }

      if (edit?.hookHoldMs) {
        hookTimer = setTimeout(() => {
          if (!cancelled) setShowHook(false);
        }, edit.hookHoldMs);
      }

      const lyricLines =
        variant?.copy.lyrics?.map((l) => l.text) ?? variant?.copy.onScreenText ?? [];
      if (lyricLines.length > 1) {
        captionTimer = setInterval(() => {
          setCaptionIndex((i) => (i + 1) % lyricLines.length);
        }, 1600);
      }

      if (edit && edit.jumpCutEveryMs > 0) {
        jumpTimer = setInterval(() => {
          if (cancelled) return;
          try {
            const next = Math.min(
              player.currentTime + edit.jumpCutSkipMs / 1000,
              Math.max(0, player.duration - 0.4)
            );
            if (edit.endMs && next * 1000 >= edit.endMs) {
              player.currentTime = edit.startMs / 1000;
            } else {
              player.currentTime = Math.max(edit.startMs / 1000, next);
            }
          } catch {
            /* ignore */
          }
        }, edit.jumpCutEveryMs);
      }

      if (edit) {
        loopTimer = setInterval(() => {
          if (cancelled) return;
          try {
            const posMs = player.currentTime * 1000;
            const durMs = player.duration * 1000;
            if (edit.endMs && posMs >= edit.endMs) {
              player.currentTime = edit.startMs / 1000;
              player.play();
            } else if (durMs > 0 && posMs >= durMs - 250) {
              player.currentTime = edit.startMs / 1000;
              player.play();
            }
          } catch {
            /* ignore */
          }
        }, 400);
      }
    };

    run();

    return () => {
      cancelled = true;
      if (jumpTimer) clearInterval(jumpTimer);
      if (captionTimer) clearInterval(captionTimer);
      if (hookTimer) clearTimeout(hookTimer);
      if (loopTimer) clearInterval(loopTimer);
      try {
        music.pause();
      } catch {
        /* ignore */
      }
    };
    // player/music are stable for this remounted instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, variant?.id, withAudio]);

  const zoom = edit?.zoom ?? 1;
  const lyricLines =
    variant?.copy.lyrics?.map((l) => l.text) ?? variant?.copy.onScreenText ?? [];
  const activeLine = lyricLines[captionIndex] ?? lyricLines[0] ?? '';
  const isEmphasis = variant?.copy.lyrics?.[captionIndex]?.emphasis;

  return (
    <View style={[styles.frame, compact && styles.compact]} collapsable={false}>
      <View style={styles.videoClip}>
        <VideoView
          player={player}
          style={[styles.video, { transform: [{ scale: zoom }] }]}
          contentFit="cover"
          nativeControls={false}
        />
      </View>

      {edit ? (
        <>
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: edit.grade.tint }]}
          />
          {edit.grade.contrast > 0 ? (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: `rgba(0,0,0,${edit.grade.contrast * 0.35})` },
              ]}
            />
          ) : null}
          {edit.grade.vignette > 0 ? (
            <View
              pointerEvents="none"
              style={[styles.vignette, { opacity: edit.grade.vignette }]}
            />
          ) : null}
          {edit.letterbox ? (
            <>
              <View style={styles.letterTop} />
              <View style={styles.letterBottom} />
            </>
          ) : null}
        </>
      ) : null}

      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: variant ? overlayColor[variant.overlayStyle] : 'transparent' },
        ]}
      />

      {variant ? (
        <View style={styles.overlayCopy} pointerEvents="none">
          {showHook ? (
            <Animated.View
              key={variant.id + '-hook'}
              entering={FadeInDown.duration(280)}
              style={[
                styles.hookPill,
                variant.overlayStyle === 'neon' && styles.hookNeon,
                variant.overlayStyle === 'minimal' && styles.hookMinimal,
                variant.overlayStyle === 'lyric' && styles.hookLyric,
              ]}
            >
              <Text
                style={[
                  styles.hookText,
                  variant.overlayStyle === 'minimal' && { color: '#111' },
                  variant.language === 'ar' || variant.language === 'darija' ? styles.rtl : null,
                ]}
              >
                {variant.copy.hook}
              </Text>
            </Animated.View>
          ) : (
            <View />
          )}

          <Animated.View
            key={activeLine + captionIndex}
            entering={FadeInUp.duration(220)}
            style={[styles.lineChip, isEmphasis && styles.lineChipHot]}
          >
            <Text style={[styles.lineText, isEmphasis && styles.lineTextHot]}>{activeLine}</Text>
          </Animated.View>

          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {edit ? `${edit.rate.toFixed(2)}x · ${edit.grade.saturationLabel}` : 'RAW'}
            </Text>
            <Text style={styles.meta}>{variant.musicLabel}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.rawBadge}>
          <Text style={styles.rawText}>RAW TAKE</Text>
        </View>
      )}

      {variant ? (
        <View style={styles.cutBadge}>
          <Text style={styles.cutBadgeText}>CUT {variant.index}</Text>
        </View>
      ) : null}

      {Platform.OS === 'web' && variant ? (
        <View style={styles.webHint}>
          <Text style={styles.webHintText}>Live edited playback</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 520,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: colors.line,
  },
  compact: {
    maxHeight: 380,
  },
  videoClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 40,
    borderColor: 'rgba(0,0,0,0.85)',
  },
  letterTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: '#000',
  },
  letterBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: '#000',
  },
  overlayCopy: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
  },
  hookPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    maxWidth: '95%',
  },
  hookNeon: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'rgba(255,77,109,0.25)',
  },
  hookMinimal: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  hookLyric: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderLeftWidth: 3,
    borderLeftColor: colors.teal,
  },
  hookText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  rtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  lineChip: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: '92%',
  },
  lineChipHot: {
    backgroundColor: 'rgba(255,77,109,0.88)',
    transform: [{ scale: 1.04 }],
  },
  lineText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
  },
  lineTextHot: {
    fontSize: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  meta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '700',
    flexShrink: 1,
  },
  rawBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  rawText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cutBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  cutBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  webHint: {
    position: 'absolute',
    bottom: 40,
    left: 12,
    backgroundColor: 'rgba(46,230,166,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  webHintText: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: '700',
  },
});
