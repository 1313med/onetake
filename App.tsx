import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GOAL_OPTIONS, LANGUAGE_OPTIONS } from './src/agent/generateVariants';
import {
  API_BASE,
  healthCheck,
  pollJob,
  startStudioJob,
  type StudioJob,
} from './src/api/studioApi';
import { AnimatedBackground } from './src/components/AnimatedBackground';
import { PrimaryButton } from './src/components/PrimaryButton';
import { ProcessingOrb } from './src/components/ProcessingOrb';
import { StudioResults } from './src/components/StudioResults';
import { VideoPreview } from './src/components/VideoPreview';
import { colors, radii, spacing } from './src/theme';
import type { AppStep, Goal, Language } from './src/types';

export default function App() {
  const [step, setStep] = useState<AppStep>('home');
  const [uri, setUri] = useState<string | null>(null);
  const [durationMillis, setDurationMillis] = useState<number | null>(null);
  const [niche, setNiche] = useState('speaking tips');
  const [spokenNotes, setSpokenNotes] = useState(
    'Stop repeating the same mistake.\nSay it shorter and clearer.\nThis is the line people will remember.'
  );
  const [cta, setCta] = useState('Follow for clean takes daily');
  const [goal, setGoal] = useState<Goal>('views');
  const [languages, setLanguages] = useState<Language[]>(['en', 'fr', 'darija']);
  const [processingStep, setProcessingStep] = useState(0);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobMessage, setJobMessage] = useState('Starting studio pipeline…');
  const [studioJob, setStudioJob] = useState<StudioJob | null>(null);

  useEffect(() => {
    if (step !== 'processing' || !uri) return;

    let cancelled = false;
    const signal = { cancelled: false };

    (async () => {
      try {
        await healthCheck();
        setJobMessage('Uploading source to render studio…');
        setJobProgress(0.02);
        setProcessingStep(0);

        const { id } = await startStudioJob({
          uri,
          niche,
          spokenNotes,
          goal,
          cta,
          languages,
        });

        const finalJob = await pollJob(
          id,
          (job) => {
            if (cancelled) return;
            setStudioJob(job);
            setJobProgress(job.progress || 0);
            setJobMessage(job.message || job.phase);
            const phaseStep =
              job.phase === 'ingest' || job.phase === 'media_prep' || job.phase === 'analyze'
                ? 0
                : job.phase === 'transcribe'
                  ? 1
                  : job.phase === 'director' || job.phase === 'plan'
                    ? 2
                    : job.phase === 'render'
                      ? 3 + Math.min(2, (job.outputs?.length || 0))
                      : job.phase === 'qc'
                        ? 5
                        : 5;
            setProcessingStep(phaseStep);
          },
          signal
        );

        if (cancelled) return;
        if (finalJob.status === 'failed') {
          throw new Error(finalJob.message || 'Render failed');
        }
        setStudioJob(finalJob);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined
        );
        setStep('results');
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        Alert.alert(
          'Studio pipeline error',
          `${msg}\n\nStudio API: ${API_BASE}\n\nSame Wi‑Fi as this PC, then reload Expo.\nIf the PC IP changed, update src/api/studioApi.ts`
        );
        setStep('setup');
      }
    })();

    return () => {
      cancelled = true;
      signal.cancelled = true;
    };
  }, [step, uri, niche, spokenNotes, goal, cta, languages]);

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload raw footage.');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
      // Long messy practice takes are welcome (multi-minute)
    });

    if (picked.canceled || !picked.assets?.[0]?.uri) return;
    const asset = picked.assets[0];
    setUri(asset.uri);
    // expo-image-picker: duration is milliseconds for videos
    setDurationMillis(asset.duration != null ? Math.round(asset.duration) : null);
    Haptics.selectionAsync().catch(() => undefined);
    setStep('setup');
  };

  const toggleLanguage = (id: Language) => {
    setLanguages((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((l) => l !== id);
      }
      return [...prev, id];
    });
  };

  const startAgent = () => {
    if (!uri) return;
    setProcessingStep(0);
    setJobProgress(0);
    setJobMessage('Connecting to studio render server…');
    setStudioJob(null);
    setStep('processing');
  };

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <AnimatedBackground />
        <SafeAreaView style={styles.safe}>
          <StatusBar style="light" />
          {step === 'home' && <Home onStart={pickVideo} />}
          {step === 'setup' && uri && (
            <Setup
              uri={uri}
              durationMillis={durationMillis}
              niche={niche}
              spokenNotes={spokenNotes}
              cta={cta}
              goal={goal}
              languages={languages}
              onNiche={setNiche}
              onSpokenNotes={setSpokenNotes}
              onCta={setCta}
              onGoal={setGoal}
              onToggleLang={toggleLanguage}
              onBack={() => setStep('home')}
              onRepick={pickVideo}
              onGenerate={startAgent}
            />
          )}
          {step === 'processing' && (
            <Processing
              stepIndex={processingStep}
              progress={jobProgress}
              message={jobMessage}
            />
          )}
          {step === 'results' && studioJob && (
            <StudioResults
              job={studioJob}
              onRestart={() => {
                setStudioJob(null);
                setUri(null);
                setDurationMillis(null);
                setStep('home');
              }}
            />
          )}
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

function Home({ onStart }: { onStart: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <Text style={styles.brand}>OneTake</Text>
        <Text style={styles.tagline}>AI personal video production studio.</Text>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(120).duration(550)} style={styles.heroCard}>
        <LinearGradient
          colors={['rgba(255,77,109,0.22)', 'rgba(46,230,166,0.10)', 'rgba(20,24,32,0.9)']}
          style={styles.heroGradient}
        >
          <Text style={styles.heroTitle}>Just talk. We produce.</Text>
          <Text style={styles.heroBody}>
            You are not a content creator — you just record. We watch the whole take first, then
            deliver 5 Super Editor variants of the same cleaned story — different hooks, captions,
            music, and motion — with your voice and meaning intact.
          </Text>
          <View style={styles.heroStats}>
            <Stat label="Studio cuts" value="5" />
            <Stat label="Roles" value="9+" />
            <Stat label="Format" value="9:16" />
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(220).duration(500)} style={{ gap: 12 }}>
        <Feature text="Understand entire recording before any cut" />
        <Feature text="Preserve meaning · Darija / AR / FR / EN code-switch" />
        <Feature text="5 A/B variants · same story · test what wins" />
      </Animated.View>

      <PrimaryButton label="Upload your recording" onPress={onStart} style={{ marginTop: 28 }} />
    </ScrollView>
  );
}

function Setup({
  uri,
  durationMillis,
  niche,
  spokenNotes,
  cta,
  goal,
  languages,
  onNiche,
  onSpokenNotes,
  onCta,
  onGoal,
  onToggleLang,
  onBack,
  onRepick,
  onGenerate,
}: {
  uri: string;
  durationMillis: number | null;
  niche: string;
  spokenNotes: string;
  cta: string;
  goal: Goal;
  languages: Language[];
  onNiche: (v: string) => void;
  onSpokenNotes: (v: string) => void;
  onCta: (v: string) => void;
  onGoal: (v: Goal) => void;
  onToggleLang: (v: Language) => void;
  onBack: () => void;
  onRepick: () => void;
  onGenerate: () => void;
}) {
  const durLabel =
    durationMillis && durationMillis > 0
      ? `${Math.round(durationMillis / 1000)}s raw footage`
      : 'Raw footage ready';

  return (
    <ScrollView contentContainerStyle={styles.setupContent} showsVerticalScrollIndicator={false}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.screenTitle}>Brief the studio</Text>
      <Text style={styles.screenSub}>
        Record naturally — repeats and pauses are OK. The studio analyzes everything first, then
        builds 5 complete creative productions of your strongest story.
      </Text>

      <VideoPreview uri={uri} compact withAudio={false} />
      <Text style={styles.durBadge}>{durLabel}</Text>
      <PrimaryButton label="Change footage" onPress={onRepick} variant="ghost" />

      <Text style={styles.label}>What is the video about?</Text>
      <TextInput
        value={niche}
        onChangeText={onNiche}
        placeholder="e.g. how to pronounce this phrase, gym tip, cafe story"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />

      <Text style={styles.label}>Lines you said / want to nail (lyrics seed)</Text>
      <TextInput
        value={spokenNotes}
        onChangeText={onSpokenNotes}
        placeholder="Paste the phrases you repeated… one idea per line"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.inputTall]}
        multiline
        textAlignVertical="top"
      />

      <Text style={styles.label}>Goal</Text>
      <View style={styles.rowWrap}>
        {GOAL_OPTIONS.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => onGoal(g.id)}
            style={[styles.choice, goal === g.id && styles.choiceOn]}
          >
            <Text style={[styles.choiceTitle, goal === g.id && styles.choiceTitleOn]}>
              {g.label}
            </Text>
            <Text style={styles.choiceHint}>{g.hint}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Languages</Text>
      <View style={styles.rowWrap}>
        {LANGUAGE_OPTIONS.map((l) => {
          const on = languages.includes(l.id);
          return (
            <Pressable
              key={l.id}
              onPress={() => onToggleLang(l.id)}
              style={[styles.langChip, on && styles.langChipOn]}
            >
              <Text style={[styles.langText, on && styles.langTextOn]}>
                {l.flag} {l.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>CTA</Text>
      <TextInput
        value={cta}
        onChangeText={onCta}
        placeholder="Follow / Comment / Link in bio"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />

      <PrimaryButton
        label="Produce 5 studio versions"
        onPress={onGenerate}
        style={{ marginTop: 10 }}
      />
    </ScrollView>
  );
}

function Processing({
  stepIndex,
  progress,
  message,
}: {
  stepIndex: number;
  progress: number;
  message: string;
}) {
  return (
    <View style={styles.processing}>
      <Text style={styles.screenTitle}>Studio pipeline</Text>
      <Text style={styles.screenSub}>
        Real Whisper transcription · editorial timelines · FFmpeg render with burned captions
      </Text>
      <ProcessingOrb stepIndex={stepIndex} />
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
      <Text style={styles.progressMsg}>{message}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <View style={styles.feature}>
      <View style={styles.dot} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  homeContent: {
    padding: spacing.lg,
    paddingBottom: 48,
    gap: 8,
  },
  brand: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  brandSmall: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tagline: {
    color: colors.muted,
    fontSize: 18,
    marginTop: 4,
    marginBottom: 18,
  },
  heroCard: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.line,
  },
  heroGradient: {
    padding: 20,
    gap: 10,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroBody: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 20,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: colors.teal,
  },
  featureText: {
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  setupContent: {
    padding: spacing.lg,
    gap: 12,
    paddingBottom: 48,
  },
  resultsContent: {
    padding: spacing.lg,
    gap: 14,
    paddingBottom: 48,
  },
  detailContent: {
    padding: spacing.lg,
    gap: 12,
    paddingBottom: 48,
  },
  processing: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: 18,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  progressPct: {
    color: colors.text,
    fontWeight: '800',
    marginTop: 10,
    textAlign: 'center',
  },
  progressMsg: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  back: {
    color: colors.muted,
    fontWeight: '600',
    marginBottom: 4,
  },
  screenTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  screenSub: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  label: {
    color: colors.text,
    fontWeight: '700',
    marginTop: 6,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },
  inputTall: {
    minHeight: 110,
  },
  durBadge: {
    color: colors.teal,
    fontWeight: '700',
    fontSize: 12,
    marginTop: -4,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    width: '48%',
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  choiceOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  choiceTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  choiceTitleOn: {
    color: colors.accent,
  },
  choiceHint: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  langChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.line,
  },
  langChipOn: {
    borderColor: colors.teal,
    backgroundColor: colors.tealSoft,
  },
  langText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 12,
  },
  langTextOn: {
    color: colors.teal,
  },
  compareHint: {
    backgroundColor: colors.tealSoft,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(46,230,166,0.25)',
  },
  compareHintText: {
    color: colors.teal,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  planBox: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 6,
  },
  planTitle: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: 2,
  },
  planLine: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  info: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 6,
  },
  infoTitle: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoBody: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  recBanner: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  recBannerText: {
    color: colors.teal,
    fontWeight: '800',
    fontSize: 12,
  },
});
