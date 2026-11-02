import { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { StudioJob, StudioOutput } from '../api/studioApi';
import { mediaUrl } from '../api/studioApi';
import { colors, radii, spacing } from '../theme';
import { PrimaryButton } from './PrimaryButton';

type Props = {
  job: StudioJob;
  onRestart: () => void;
};

export function StudioResults({ job, onRestart }: Props) {
  const recommended = job.outputs[0];
  const [activeId, setActiveId] = useState(recommended?.id || job.outputs[0]?.id);

  const active = job.outputs.find((o) => o.id === activeId) || job.outputs[0];

  return (
    <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
      <Text style={styles.kicker}>OneTake Studio · Delivery</Text>
      <Text style={styles.title}>5 Super Editor variants</Text>
      <Text style={styles.sub}>
        Analyzed {job.meta?.duration ? `${job.meta.duration.toFixed(0)}s` : 'source'} once · ASR{' '}
        {job.transcriptSummary?.provider || '?'}/{job.transcriptSummary?.model || '?'} · lang≈
        {job.transcriptSummary?.language || '?'} · {job.transcriptSummary?.segments || 0} segments
        {job.editorialSummary?.engine ? ` · ${job.editorialSummary.engine}` : ''} · same cleaned
        spine · A/B hooks & polish
      </Text>
      {job.transcriptSummary?.lowConfidenceSpans ? (
        <Text style={styles.warn}>
          Caption confidence: {job.transcriptSummary.lowConfidenceSpans} low-confidence spans —
          review Darija lines before publishing.
        </Text>
      ) : null}

      {active ? <LazyPlayer key={active.id} output={active} /> : null}

      <View style={styles.grid}>
        {job.outputs.map((o) => {
          const on = o.id === active?.id;
          const rec = o.index === 1;
          return (
            <Pressable
              key={o.id}
              onPress={() => setActiveId(o.id)}
              style={[styles.card, on && styles.cardOn, rec && styles.cardRec]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardIndex}>0{o.index}</Text>
                {rec ? <Text style={styles.rec}>Recommended</Text> : null}
              </View>
              <Text style={styles.cardName}>{o.name}</Text>
              <Text style={styles.cardMeta}>
                {o.duration.toFixed(1)}s · {o.width}x{o.height} · {o.timelineClips} takes ·{' '}
                {o.captionEvents} caption events
              </Text>
              <Text style={styles.cardStyle}>Captions: {o.captionStyle}</Text>
              <Text style={styles.cardWhy} numberOfLines={3}>
                {o.rationale}
              </Text>
              <Text style={[styles.qa, o.qa?.ok ? styles.qaOk : styles.qaBad]}>
                QA {o.qa?.ok ? 'PASS' : 'CHECK'}
              </Text>
              {o.warnings?.length ? (
                <Text style={styles.warn} numberOfLines={2}>
                  {o.warnings.slice(0, 2).join(' · ')}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {active ? (
        <PrimaryButton
          label={`Download ${active.name}`}
          onPress={() => Linking.openURL(mediaUrl(active.url))}
        />
      ) : null}

      <PrimaryButton label="New recording" onPress={onRestart} variant="ghost" />
    </ScrollView>
  );
}

function LazyPlayer({ output }: { output: StudioOutput }) {
  const uri = mediaUrl(output.url);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <View style={styles.playerWrap}>
      <VideoView player={player} style={styles.player} contentFit="cover" nativeControls />
      <View style={styles.playerBadge}>
        <Text style={styles.playerBadgeText}>{output.name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, gap: 14, paddingBottom: 48 },
  kicker: {
    color: colors.accent,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  sub: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  warn: { color: colors.amber, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  playerWrap: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#000',
    aspectRatio: 9 / 16,
    maxHeight: 420,
  },
  player: { width: '100%', height: '100%' },
  playerBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  playerBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  grid: { gap: 10 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 6,
  },
  cardOn: { borderColor: colors.accent },
  cardRec: { borderColor: 'rgba(46,230,166,0.55)' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardIndex: { color: colors.accent, fontWeight: '900', fontSize: 16 },
  rec: {
    color: colors.teal,
    fontWeight: '800',
    fontSize: 11,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cardName: { color: colors.text, fontWeight: '800', fontSize: 17 },
  cardMeta: { color: colors.muted, fontSize: 11 },
  cardStyle: { color: colors.blue, fontSize: 12, fontWeight: '700' },
  cardWhy: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  qa: { fontWeight: '800', fontSize: 11, marginTop: 4 },
  qaOk: { color: colors.teal },
  qaBad: { color: colors.amber },
});
