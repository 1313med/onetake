import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, radii } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
  style?: ViewStyle;
};

export function PrimaryButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
  style,
}: Props) {
  const handle = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    onPress();
  };

  if (variant === 'ghost') {
    return (
      <Pressable
        onPress={handle}
        disabled={disabled}
        style={[styles.ghost, style, disabled && styles.disabled]}
      >
        <Text style={styles.ghostText}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(400)} style={style}>
      <Pressable onPress={handle} disabled={disabled} style={disabled && styles.disabled}>
        <LinearGradient
          colors={disabled ? ['#3A404A', '#3A404A'] : ['#FF4D6D', '#FF7A59']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>{label}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  primaryText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ghost: {
    height: 52,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 18,
  },
  ghostText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
