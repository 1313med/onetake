#!/usr/bin/env python3
"""Compare original vs edited reference pair for OneTake style learning."""
import json
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
FFPROBE = Path(r"C:\Users\Lenovo\OneTakeApp\node_modules\@ffprobe-installer\win32-x64\ffprobe.exe")
FFMPEG = Path(r"C:\Users\Lenovo\OneTakeApp\node_modules\@ffmpeg-installer\win32-x64\ffmpeg.exe")


def probe(path: Path) -> dict:
    out = subprocess.check_output(
        [str(FFPROBE), "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        text=True,
    )
    return json.loads(out)


def summarize(path: Path) -> dict:
    d = probe(path)
    fmt = d["format"]
    vs = next(s for s in d["streams"] if s["codec_type"] == "video")
    aus = [s for s in d["streams"] if s["codec_type"] == "audio"]
    return {
        "file": path.name,
        "duration_sec": float(fmt["duration"]),
        "size_mb": int(fmt["size"]) / 1e6,
        "width": int(vs.get("width") or 0),
        "height": int(vs.get("height") or 0),
        "fps": vs.get("r_frame_rate"),
        "video_codec": vs.get("codec_name"),
        "audio_codec": aus[0].get("codec_name") if aus else None,
        "nb_streams": len(d["streams"]),
        "has_subtitle_stream": any(s.get("codec_type") == "subtitle" for s in d["streams"]),
        "pix_fmt": vs.get("pix_fmt"),
        "bit_rate": int(fmt.get("bit_rate") or 0),
    }


def extract_frames(src: Path, out_dir: Path, fps_expr: str):
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.jpg"):
        old.unlink()
    subprocess.check_call(
        [str(FFMPEG), "-y", "-i", str(src), "-vf", f"fps={fps_expr}", "-q:v", "3", str(out_dir / "%03d.jpg")],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return sorted(out_dir.glob("*.jpg"))


def scene_cuts(src: Path, threshold: float = 0.28) -> list[float]:
    """Return approximate cut times using ffmpeg scene detect."""
    cmd = [
        str(FFMPEG),
        "-i",
        str(src),
        "-filter:v",
        f"select='gt(scene,{threshold})',showinfo",
        "-f",
        "null",
        "-",
    ]
    p = subprocess.run(cmd, capture_output=True, text=True)
    times = []
    for line in (p.stderr or "").splitlines():
        if "pts_time:" in line:
            try:
                part = line.split("pts_time:")[1].split(" ")[0]
                times.append(float(part))
            except Exception:
                pass
    return times


def silence_stats(src: Path) -> dict:
    wav = ROOT / "analysis" / f"{src.stem}_mono.wav"
    wav.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [str(FFMPEG), "-y", "-i", str(src), "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(wav)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    with wave.open(str(wav), "rb") as w:
        n = w.getnframes()
        raw = w.readframes(n)
        sr = w.getframerate()
    audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    hop = int(sr * 0.25)
    rms = []
    for i in range(0, len(audio) - hop, hop):
        chunk = audio[i : i + hop]
        rms.append(float(np.sqrt(np.mean(chunk * chunk))))
    arr = np.array(rms)
    thr = max(0.01, float(np.median(arr) * 0.35))
    silent = arr < thr
    # contiguous silent runs
    runs = []
    start = None
    for i, s in enumerate(silent):
        if s and start is None:
            start = i
        if (not s or i == len(silent) - 1) and start is not None:
            end = i if not s else i + 1
            dur = (end - start) * 0.25
            if dur >= 0.5:
                runs.append({"start": start * 0.25, "end": end * 0.25, "dur": dur})
            start = None
    speech_ratio = 1.0 - (float(np.mean(silent)) if len(silent) else 0)
    return {
        "speech_ratio": speech_ratio,
        "median_rms": float(np.median(arr)) if len(arr) else 0,
        "long_silences_ge_0_5s": len(runs),
        "longest_silence_sec": max((r["dur"] for r in runs), default=0),
        "silence_runs": runs[:20],
    }


def main():
    original = ROOT / "vid1_original.mp4"
    edited = ROOT / "vid1_edited.mp4"
    analysis = ROOT / "analysis"
    analysis.mkdir(exist_ok=True)

    so = summarize(original)
    se = summarize(edited)
    print("ORIGINAL", json.dumps(so, indent=2))
    print("EDITED", json.dumps(se, indent=2))
    print(f"Compression ratio duration: {se['duration_sec']/so['duration_sec']:.2%} of original")

    fo = extract_frames(original, ROOT / "frames_original", "1/4")
    fe = extract_frames(edited, ROOT / "frames_edited", "1/1.5")
    print(f"frames original={len(fo)} edited={len(fe)}")

    cuts_e = scene_cuts(edited, 0.25)
    cuts_o = scene_cuts(original, 0.35)
    print(f"scene cuts edited(thr0.25)={len(cuts_e)} times={cuts_e[:30]}")
    print(f"scene cuts original(thr0.35)={len(cuts_o)} (first 10)={cuts_o[:10]}")

    sil_e = silence_stats(edited)
    sil_o = silence_stats(original)
    print("silence edited", {k: sil_e[k] for k in sil_e if k != "silence_runs"})
    print("silence original", {k: sil_o[k] for k in sil_o if k != "silence_runs"})

    # Average cut spacing
    if len(cuts_e) >= 2:
        gaps = np.diff([0.0] + cuts_e + [se["duration_sec"]])
        print(
            "edited cut spacing sec: median={:.2f} mean={:.2f} min={:.2f} max={:.2f}".format(
                float(np.median(gaps)), float(np.mean(gaps)), float(np.min(gaps)), float(np.max(gaps))
            )
        )

    report = {
        "original": so,
        "edited": se,
        "duration_ratio": se["duration_sec"] / max(so["duration_sec"], 0.01),
        "edited_scene_cuts": cuts_e,
        "original_scene_cuts_sample": cuts_o[:40],
        "silence_edited": sil_e,
        "silence_original": sil_o,
        "frame_counts": {"original": len(fo), "edited": len(fe)},
    }
    (analysis / "pair_analysis.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("Wrote", analysis / "pair_analysis.json")


if __name__ == "__main__":
    main()
