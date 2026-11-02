# Darija ASR benchmark

Compare transcription providers on **your** Moroccan Darija (+ FR/EN) audio before locking `ASR_PROVIDER`.

## Run

```bash
# Uses a real job WAV if present; trims to 90s by default
node server/scripts/asr_benchmark/run.js --max-sec 60

# Explicit clip + reference
node server/scripts/asr_benchmark/run.js --clip path/to/audio.wav --ref server/scripts/asr_benchmark/references/my_ref.json --max-sec 90

# Include tiny only as a negative baseline (never for publish)
node server/scripts/asr_benchmark/run.js --allow-tiny-baseline --max-sec 30
```

## Reference file

Copy `references/sample_ref.template.json` and fill `text` + `keywords`.

## Outputs

- `out/benchmark_report.md`
- `out/results.json`
- `out/hyp_*.json`

## Env keys (optional per provider)

- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `GLADIA_API_KEY`

Missing keys → provider **SKIPPED** (no silent Whisper-tiny fallback).
