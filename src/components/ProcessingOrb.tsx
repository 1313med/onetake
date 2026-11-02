import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme';

const STEPS = [
  'Validating upload · preparing audio & proxy…',
  'Transcribing full recording (Darija-aware ASR)…',
  'AI Director: ideas, retakes, edit decisions…',
  'Rendering creative versions in parallel…',
  'Captions · motion · grade · music mix…',
  'Quality gate · publication-ready check…',
];

type Props = { stepIndex: number };

export function ProcessingOrb({ stepIndex }: Props) {
  const label = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  const pulse = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    spin.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
  }, [pulse, spin]);

  const outerStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + pulse.value * 0.5,
    transform: [{ scale: 0.85 + pulse.value * 0.23 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.92 + pulse.value * 0.08 }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.ringOuter, outerStyle]} />
      <Animated.View style={[styles.ring, ringStyle]} />
      <Animated.View style={[styles.core, coreStyle]}>
        <Text style={styles.coreText}>OT</Text>
      </Animated.View>
      <Animated.View key={label} entering={FadeInDown.duration(280)} style={styles.labelWrap}>
        <Text style={styles.label}>{label}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', minHeight: 280 },
  ringOuter: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  ring: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  core: {
    width: 108,
    height: 108,
    borderRadius: 999,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreText: { color: colors.text, fontWeight: '900', fontSize: 28, letterSpacing: 1 },
  labelWrap: { position: 'absolute', bottom: 8, paddingHorizontal: 16 },
  label: { color: colors.muted, textAlign: 'center', fontSize: 13, fontWeight: '600' },
});
