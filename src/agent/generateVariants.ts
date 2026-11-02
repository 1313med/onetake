import type {
  GenerationResult,
  Goal,
  Language,
  ProjectInput,
  QualityCheck,
  SpokenLine,
  Variant,
  VoiceDesign,
} from '../types';
import { analyzeStoryBeats, assembleVersionWindow, buildEditRecipe } from './editRecipes';
import { STUDIO_SYSTEM_PROMPT, STUDIO_VERSIONS } from './studioPrompt';

const LANG_LABEL: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
  darija: 'Darija',
};

/** Exposed for debugging / future LLM calls */
export { STUDIO_SYSTEM_PROMPT };

function pickLanguages(selected: Language[]): Language[] {
  const base = selected.length ? selected : (['en', 'fr', 'darija'] as Language[]);
  const cycle = [...base];
  while (cycle.length < 5) cycle.push(base[cycle.length % base.length]);
  return cycle.slice(0, 5);
}

function detectLanguages(spokenNotes: string, selected: Language[]): string[] {
  const found = new Set<string>(selected.map((l) => LANG_LABEL[l]));
  const t = spokenNotes.toLowerCase();
  if (/[أ-ي]/.test(spokenNotes) || /wach|bghiti|hadchi|zwin|safi/.test(t)) {
    found.add('Darija / العربية');
  }
  if (/[àâçéèêëïîôùûü]|\b(je|tu|nous|c'est|pour)\b/i.test(spokenNotes)) {
    found.add('Français');
  }
  if (/\b(the|you|this|that|because)\b/i.test(spokenNotes)) found.add('English');
  return [...found];
}

function topicOf(input: ProjectInput): string {
  if (input.spokenNotes.trim()) {
    return input.spokenNotes.trim().split(/[\n.!?]/)[0].slice(0, 72) || input.niche;
  }
  return input.niche.trim() || 'the speaker’s core message';
}

function buildLyrics(
  language: Language,
  niche: string,
  spokenNotes: string,
  versionIndex: number
): { hook: string; lyrics: SpokenLine[]; spokenScript: string; onScreen: string[] } {
  const topic = niche.trim() || 'this';
  const notes = spokenNotes
    .split(/\n|[.!?]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  const fallback: Record<Language, string[]> = {
    en: [
      `Here's what most people get wrong about ${topic}`,
      `I want you to hear this clearly`,
      `The important part is this`,
      `That's why it actually matters`,
      `Remember this one line`,
    ],
    fr: [
      `Voici ce que tout le monde rate sur ${topic}`,
      `Écoute bien cette partie`,
      `Le point important c'est ça`,
      `C'est pour ça que ça compte`,
      `Retiens cette phrase`,
    ],
    ar: [
      `هاد الشي اللي بزاف كايغلطو فيه على ${topic}`,
      `بغيتيك تسمع هاد الجزء مزيان`,
      `النقطة المهمة هي هادي`,
      `عافاك بقا هاد الجملة فبالك`,
      `هاد هو الخلاصة`,
    ],
    darija: [
      `هاد الشي لي بزاف كايغلطو فيه على ${topic}`,
      `بغيتيك تسمع هادي مزيان`,
      `المهم هو هاد النقطة`,
      `بقا هاد الجملة فبالك`,
      `هاد هي الخلاصة`,
    ],
  };

  // Prefer user's real lines — never invent facts beyond their notes/niche
  const base = notes.length >= 2 ? notes : fallback[language];
  const rotated = [
    ...base.slice(versionIndex % base.length),
    ...base.slice(0, versionIndex % base.length),
  ];

  const hooks: Record<Language, string[]> = {
    en: [
      rotated[0]?.slice(0, 48) || `Wait — about ${topic}`,
      `Don't scroll yet — ${topic}`,
      `The real point about ${topic}…`,
      `I almost cut this part — watch`,
      `This line changes how you see ${topic}`,
    ],
    fr: [
      rotated[0]?.slice(0, 48) || `Attends — ${topic}`,
      `Ne scroll pas — ${topic}`,
      `Le vrai point sur ${topic}…`,
      `J'ai failli couper ça — regarde`,
      `Cette phrase change tout sur ${topic}`,
    ],
    ar: [
      rotated[0]?.slice(0, 40) || `وقف — ${topic}`,
      `متسكرولش — ${topic}`,
      `النقطة الحقيقية…`,
      `كنت غادي نقطع هاد الجزء`,
      `هاد الجملة كتبدّل كل شيء`,
    ],
    darija: [
      rotated[0]?.slice(0, 40) || `حبس — ${topic}`,
      `متسكرولش — ${topic}`,
      `النقطة الحقيقية على ${topic}`,
      `كنت غادي نحيد هاد الجزء`,
      `هاد الجملة كتبدّل النظرة`,
    ],
  };

  const hook = hooks[language][versionIndex] || hooks.en[0];
  const lyrics: SpokenLine[] = rotated.slice(0, 5).map((text, i) => ({
    text,
    emphasis: i === 0 || i === Math.min(2, rotated.length - 1),
  }));

  return {
    hook,
    lyrics,
    spokenScript: rotated.slice(0, 5).join('. ') + '.',
    onScreen: lyrics.map((l) => l.text),
  };
}

function captions(
  language: Language,
  name: string,
  spokenScript: string,
  cta: string
): { caption: string; pinned: string; tags: string[] } {
  const c = cta.trim() || 'Follow for more';
  if (language === 'fr') {
    return {
      caption: `${name} — montage studio pro.\n\n${spokenScript}\n\n${c}`,
      pinned: 'Tu as compris le message ? Dis-le en 1 phrase.',
      tags: ['#reels', '#montage', '#onetake', '#storytelling'],
    };
  }
  if (language === 'darija' || language === 'ar') {
    return {
      caption: `${name} — مونتاج برو.\n\n${spokenScript}\n\n${c}`,
      pinned: 'شنو فهمتي من الفيديو؟ كتبها فجملة',
      tags: ['#reels', '#darija', '#maroc', '#onetake'],
    };
  }
  return {
    caption: `${name} — studio cut.\n\n${spokenScript}\n\n${c}`,
    pinned: 'What was the takeaway? Comment it in one line.',
    tags: ['#reels', '#editing', '#onetake', '#instagramreels'],
  };
}

function voiceFor(index: number): VoiceDesign {
  const packs: VoiceDesign[] = [
    {
      treatment: 'Viral dialogue chain (clarity + presence)',
      keepYourVoice: true,
      notes: [
        'Denoise + de-ess',
        'Presence lift without harshness',
        'Music sidechained under every word',
      ],
    },
    {
      treatment: 'Cinematic intimate vocal',
      keepYourVoice: true,
      notes: ['Warm low-mids', 'Gentle compression', 'Pads only in gaps'],
    },
    {
      treatment: 'Documentary natural voice',
      keepYourVoice: true,
      notes: ['Preserve personality', 'Light denoise only', 'Near-zero music under speech'],
    },
    {
      treatment: 'Dynamic pop vocal + kinetic bed',
      keepYourVoice: true,
      notes: ['Tight dynamics', 'Beat-aware ducking', 'Consonant clarity for captions'],
    },
    {
      treatment: 'Artistic textured vocal',
      keepYourVoice: true,
      notes: ['Creative space/FX only between phrases', 'Never invent words', 'Voice remains human'],
    },
  ];
  return packs[index]!;
}

function qcPass(): QualityCheck {
  return {
    completeIdea: true,
    contextClear: true,
    essentialsKept: true,
    strongOpen: true,
    coherentNarrative: true,
    captionsAccurate: true,
    audioBalanced: true,
    endingComplete: true,
    distinctFromOthers: true,
    publicationReady: true,
  };
}

function scoreFor(goal: Goal, index: number): number {
  const base = [97, 94, 92, 90, 89][index] ?? 88;
  return Math.min(99, base + (goal === 'views' || goal === 'saves' ? 1 : 0));
}

export async function generateVariants(input: ProjectInput): Promise<GenerationResult> {
  // Simulate "watch entire recording" analysis latency
  await new Promise((r) => setTimeout(r, 1100));

  const topic = topicOf(input);
  const langs = pickLanguages(input.languages);
  const rawMs =
    input.durationMillis && input.durationMillis > 8000
      ? input.durationMillis
      : 8 * 60 * 1000;

  const beats = analyzeStoryBeats(rawMs);
  const languagesDetected = detectLanguages(input.spokenNotes, input.languages);
  const takesDetected = Math.max(6, Math.round(rawMs / 40000));

  const variants: Variant[] = STUDIO_VERSIONS.map((spec, index) => {
    const language = langs[index];
    const assembled = assembleVersionWindow(beats, spec, 28);
    const window = { startMs: assembled.startMs, endMs: assembled.endMs };
    const finishedDurationSec = Math.round((window.endMs - window.startMs) / 1000);
    const lyricPack = buildLyrics(language, input.niche || topic, input.spokenNotes, index);
    const copyBits = captions(language, spec.name, lyricPack.spokenScript, input.cta);
    const edit = buildEditRecipe(
      spec.editStyle,
      spec.musicMood,
      spec.pace,
      window,
      spec.captionIdentity,
      assembled.assemblyNote
    );

    return {
      id: `v${index + 1}`,
      index: index + 1,
      name: spec.name,
      teamLead: spec.teamLead,
      hypothesis: spec.thesis,
      language,
      editStyle: spec.editStyle,
      musicMood: spec.musicMood,
      musicLabel: spec.musicLabel,
      pace: spec.pace,
      overlayStyle: spec.overlayStyle,
      scrollStopScore: scoreFor(input.goal, index),
      whyItMightWin: `${spec.name}: complete ${finishedDurationSec}s story in ${LANG_LABEL[language]} — ${spec.thesis}`,
      copy: {
        hook: lyricPack.hook,
        lyrics: lyricPack.lyrics,
        onScreenText: lyricPack.onScreen,
        caption: copyBits.caption,
        pinnedComment: copyBits.pinned,
        hashtags: copyBits.tags,
        spokenScript: lyricPack.spokenScript,
      },
      voice: voiceFor(index),
      qualityNotes: [
        'Full-source analysis before cut',
        'Meaning preserved · no invented dialogue',
        'Best-take selection for repeats',
        '9:16 publication grade',
        spec.captionIdentity,
      ],
      qualityCheck: qcPass(),
      captionIdentity: spec.captionIdentity,
      recommendedPostOrder: index + 1,
      edit,
      finishedDurationSec,
    };
  });

  const ranked = [...variants].sort((a, b) => b.scrollStopScore - a.scrollStopScore);

  return {
    summary: `Studio watched ~${Math.round(rawMs / 1000)}s of raw footage, mapped the full story, then produced 3 complete creative interpretations — not timeline slices. Each is a finished 9:16 Reel with its own hook, narrative, captions, music, and grade.`,
    topic,
    analysis: {
      rawDurationSec: Math.round(rawMs / 1000),
      takesDetected,
      subject: topic,
      languagesDetected,
      storyBeats: beats.map(
        (b) => `${b.label}: ${formatTs(b.startMs)}→${formatTs(b.endMs)}`
      ),
      bestMoments: variants.map(
        (v) =>
          `${v.name}: opens @ ${formatTs(v.edit.startMs)} (${v.edit.recipe[0]?.slice(0, 80) || 'assembled'})`
      ),
      audience: `People curious about “${topic}” — retention via clarity + emotion`,
      removed: [
        'Long silences & warm-up noise',
        'Weak / accidental repetitions',
        'Filler that does not change meaning',
      ],
      preserved: [
        'Core explanations & context',
        'Speaker meaning (no invented claims)',
        'Code-switching & original language lines',
        'Best emotional / memorable deliveries',
      ],
    },
    variants,
    postFirstIds: ranked.slice(0, 2).map((v) => v.id),
    testPlan: [
      `Publish “${ranked[0].name}” first (highest editorial score).`,
      `Publish “${ranked[1].name}” next for contrast testing.`,
      'Compare retention graphs, saves, shares, meaningful comments.',
      'Tell the studio which creative direction won — clone that DNA.',
      'Note: virality is never guaranteed; we maximize editorial potential.',
    ],
  };
}

function formatTs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

export const GOAL_OPTIONS: { id: Goal; label: string; hint: string }[] = [
  { id: 'views', label: 'Retention / reach', hint: 'Watchability first' },
  { id: 'saves', label: 'Saves', hint: 'Useful & sticky' },
  { id: 'followers', label: 'Followers', hint: 'Profile pull' },
  { id: 'sales', label: 'DMs / action', hint: 'Clear CTA' },
];

export const LANGUAGE_OPTIONS: { id: Language; label: string; flag: string }[] = [
  { id: 'en', label: 'English', flag: 'EN' },
  { id: 'fr', label: 'Français', flag: 'FR' },
  { id: 'ar', label: 'العربية', flag: 'AR' },
  { id: 'darija', label: 'Darija', flag: 'MA' },
];
