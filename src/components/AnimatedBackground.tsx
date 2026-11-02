import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme';

function Blob({
  style,
  duration,
  from,
  to,
}: {
  style: object;
  duration: number;
  from: { opacity: number; scale: number; x?: number; y?: number; rotate?: number };
  to: { opacity: number; scale: number; x?: number; y?: number; rotate?: number };
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [duration, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const opacity = from.opacity + (to.opacity - from.opacity) * t;
    const scale = from.scale + (to.scale - from.scale) * t;
    const translateX = (from.x ?? 0) + ((to.x ?? 0) - (from.x ?? 0)) * t;
    const translateY = (from.y ?? 0) + ((to.y ?? 0) - (from.y ?? 0)) * t;
    const rotate = (from.rotate ?? 0) + ((to.rotate ?? 0) - (from.rotate ?? 0)) * t;
    return {
      opacity,
      transform: [
        { translateX },
        { translateY },
        { scale },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  return <Animated.View style={[style, animatedStyle]} />;
}

export function AnimatedBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#0E1116', '#141821', '#0E1116']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Blob
        style={[styles.blob, styles.blobOne]}
        duration={7000}
        from={{ opacity: 0.35, scale: 0.9, x: -40 }}
        to={{ opacity: 0.7, scale: 1.15, x: 30 }}
      />
      <Blob
        style={[styles.blob, styles.blobTwo]}
        duration={9000}
        from={{ opacity: 0.25, scale: 1, y: 20 }}
        to={{ opacity: 0.55, scale: 1.2, y: -30 }}
      />
      <Blob
        style={[styles.blob, styles.blobThree]}
        duration={11000}
        from={{ opacity: 0.15, scale: 1, rotate: 0 }}
        to={{ opacity: 0.35, scale: 1.05, rotate: 25 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobOne: {
    width: 280,
    height: 280,
    top: -40,
    right: -60,
    backgroundColor: colors.accentSoft,
  },
  blobTwo: {
    width: 240,
    height: 240,
    bottom: 120,
    left: -80,
    backgroundColor: colors.tealSoft,
  },
  blobThree: {
    width: 200,
    height: 200,
    top: '42%',
    right: -40,
    backgroundColor: colors.blueSoft,
  },
});
