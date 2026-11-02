import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { Variant } from '../types';
import { colors, radii } from '../theme';

const LANG: Record<string, string> = {
  en: 'EN',
  fr: 'FR',
  ar: 'AR',
  darija: 'Darija',
};

type Props = {
  variant: Variant;
  delay?: number;
  recommended?: boolean;
  selected?: boolean;
  onPress: () => void;
};

export function VariantCard({ variant, delay = 0, recommended, selected, onPress }: Props) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(420)}>
      <Pressable
        onPress={onPress}
        style={[styles.card, selected && styles.selected, recommended && styles.recommended]}
      >
        <View style={styles.top}>
          <View style={styles.indexBubble}>
            <Text style={styles.indexText}>{variant.index}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{variant.name}</Text>
            <Text style={styles.team} numberOfLines={1}>
              {variant.teamLead} · ~{variant.finishedDurationSec}s
            </Text>
            <Text style={styles.hypothesis} numberOfLines={2}>
              {variant.hypothesis}
            </Text>
          </View>
          <View style={styles.scoreWrap}>
            <Text style={styles.score}>{variant.scrollStopScore}</Text>
            <Text style={styles.scoreLabel}>stop</Text>
          </View>
        </View>

        <View style={styles.chips}>
          <Chip text={LANG[variant.language]} tone="teal" />
          <Chip text={`${variant.edit.rate}x`} tone="blue" />
          <Chip text={`@${(variant.edit.startMs / 1000).toFixed(1)}s`} tone="amber" />
          <Chip text={variant.editStyle} tone="blue" />
        </View>

        {recommended ? (
          <View style={styles.rec}>
            <Text style={styles.recText}>Post this first</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function Chip({
  text,
  tone,
}: {
  text: string;
  tone: 'teal' | 'blue' | 'amber';
}) {
  const bg =
    tone === 'teal' ? colors.tealSoft : tone === 'blue' ? colors.blueSoft : colors.amberSoft;
  const fg = tone === 'teal' ? colors.teal : tone === 'blue' ? colors.blue : colors.amber;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  selected: {
    borderColor: colors.accent,
  },
  recommended: {
    borderColor: 'rgba(46,230,166,0.55)',
  },
  top: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  indexBubble: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    color: colors.accent,
    fontWeight: '800',
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  team: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  hypothesis: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  scoreWrap: {
    alignItems: 'center',
  },
  score: {
    color: colors.teal,
    fontSize: 18,
    fontWeight: '900',
  },
  scoreLabel: {
    color: colors.muted,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  rec: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  recText: {
    color: colors.teal,
    fontWeight: '800',
    fontSize: 11,
  },
});
