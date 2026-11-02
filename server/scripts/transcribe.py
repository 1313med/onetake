#!/usr/bin/env python3
"""Fast multilingual ASR with word timestamps — 16k mono WAV, no PyAV."""
import json
import sys
import wave
from pathlib import Path

import numpy as np


def load_wav_mono_16k(path: str) -> np.ndarray:
    with wave.open(path, "rb") as w:
        channels = w.getnchannels()
        sr = w.getframerate()
        sampwidth = w.getsampwidth()
        n = w.getnframes()
        raw = w.readframes(n)

    if sampwidth != 2:
        raise RuntimeError(f"expected 16-bit PCM wav, got sampwidth={sampwidth}")

    audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if channels > 1:
        audio = audio.reshape(-1, channels).mean(axis=1)

    if sr != 16000:
        duration = audio.shape[0] / float(sr)
        target = int(duration * 16000)
        x_old = np.linspace(0.0, 1.0, num=audio.shape[0], endpoint=False)
        x_new = np.linspace(0.0, 1.0, num=target, endpoint=False)
        audio = np.interp(x_new, x_old, audio).astype(np.float32)

    return audio


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "usage: transcribe.py <audio.wav> <out_json>"}))
        sys.exit(1)

    audio_path = sys.argv[1]
    out = sys.argv[2]
    # tiny = much faster on CPU for hackathon; override with WHISPER_MODEL=base|small
    model_size = (sys.argv[3] if len(sys.argv) > 3 else None) or __import__("os").environ.get(
        "WHISPER_MODEL", "tiny"
    )

    print(f"PROGRESS loading_model {model_size}", flush=True)
    from faster_whisper import WhisperModel

    audio = load_wav_mono_16k(audio_path)
    dur = len(audio) / 16000.0
    print(f"PROGRESS audio_loaded duration_sec={dur:.1f}", flush=True)

    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    print("PROGRESS transcribe_start", flush=True)

    segments_iter, info = model.transcribe(
        audio,
        beam_size=1,  # faster
        best_of=1,
        word_timestamps=True,
        vad_filter=True,
        language=None,
    )

    words = []
    segs = []
    for i, seg in enumerate(segments_iter):
        segs.append(
            {
                "start": float(seg.start),
                "end": float(seg.end),
                "text": seg.text.strip(),
                "avg_logprob": float(seg.avg_logprob) if seg.avg_logprob is not None else 0.0,
                "no_speech_prob": float(seg.no_speech_prob)
                if seg.no_speech_prob is not None
                else 0.0,
            }
        )
        if seg.words:
            for w in seg.words:
                words.append(
                    {
                        "start": float(w.start),
                        "end": float(w.end),
                        "word": w.word,
                        "probability": float(w.probability) if w.probability is not None else 0.0,
                    }
                )
        if i % 3 == 0:
            pct = min(99.0, (float(seg.end) / max(dur, 0.1)) * 100.0)
            print(f"PROGRESS segment {i+1} t={seg.end:.1f}s pct={pct:.1f}", flush=True)

    result = {
        "language": info.language,
        "language_probability": float(info.language_probability),
        "duration": float(info.duration) if info.duration else dur,
        "segments": segs,
        "words": words,
        "model": model_size,
    }
    Path(out).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {"ok": True, "segments": len(segs), "words": len(words), "language": info.language}
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
