# Darija ASR benchmark report

- Source clip: `C:\Users\Lenovo\OneTakeApp\server\jobs\adbe833d-40aa-43a3-a00e-2c3b34389c26\audio.wav`
- Audio under test: `C:\Users\Lenovo\OneTakeApp\server\scripts\asr_benchmark\out\clip_trim_30s.wav` (max 30s)
- Reference provided: NO — add references/*.json for CER/WER
- Generated: 2026-11-01T13:14:30.477Z

| Run | Status | Model | ms | segs | words | CER | WER | invent | notes |
|-----|--------|-------|----|------|-------|-----|-----|--------|-------|
| localWhisper:base | ok | base | 38166 | 5 | 21 | — | — | — | سيلا فرقي لا يوفس إضافة بالنسبة للشكل لا يوفس إضافة لل Silva وإتقادية سيلا فرقي لا يوفسل ليلا فرقية سيلا فرقي |
| localWhisper:small | ok | small | 122072 | 8 | 26 | — | — | — | إهي لا 안녕 Chelsea doesn't mind He doesn't worry about crimes Chelsea doesn't mind He doesn't mind Chelsea doesn't mind Chelsea doesn't mind Chelsea doesn't mind |
| localWhisper:tiny(BASELINE_DO_NOT_PUBLISH) | ok | tiny | 16014 | 6 | 35 | — | — | — | Aceste șitam rafich... Lai ofces de Luigi T'ha cateam! Șina Тогдаfare te face dzele vete de我就 at다는a, thră de blai ofces de Luigi T' ник de... ér... Șinaomenai faresa de definitate de Freddie acei e |
| openai | skipped | — | 0 | — | — | — | — | — | OPENAI_API_KEY is not set. Cannot use OpenAI ASR provider. |
| elevenlabs | skipped | — | 0 | — | — | — | — | — | ELEVENLABS_API_KEY is not set. Cannot use ElevenLabs Scribe provider. |
| gladia | skipped | — | 2 | — | — | — | — | — | GLADIA_API_KEY is not set. Cannot use Gladia ASR provider. |

## Rules
- Whisper **tiny** is never a production candidate.
- Missing API keys = SKIPPED (not a silent local tiny fallback).
- Lock `ASR_PROVIDER` only after human review of Darija + FR/EN fidelity on your clips.

## Previews
### localWhisper:base
```
سيلا فرقي لا يوفس إضافة بالنسبة للشكل لا يوفس إضافة لل Silva وإتقادية سيلا فرقي لا يوفسل ليلا فرقية سيلا فرقي
```

### localWhisper:small
```
إهي لا 안녕 Chelsea doesn't mind He doesn't worry about crimes Chelsea doesn't mind He doesn't mind Chelsea doesn't mind Chelsea doesn't mind Chelsea doesn't mind
```

### localWhisper:tiny(BASELINE_DO_NOT_PUBLISH)
```
Aceste șitam rafich... Lai ofces de Luigi T'ha cateam! Șina Тогдаfare te face dzele vete de我就 at다는a, thră de blai ofces de Luigi T' ник de... ér... Șinaomenai faresa de definitate de Freddie acei e
```
