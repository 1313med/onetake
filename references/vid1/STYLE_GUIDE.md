# Reference pair: vid1 — style guide for OneTake

Source files:
- `vid1_original.mp4` — raw (~511s, 8:31), talking-head practice take with long silences / retakes / setup
- `vid1_edited.mp4` — publish target (~104s, 1:44)

## What the editor actually did (measured)

| Signal | Original | Edited | Implication |
|--------|----------|--------|-------------|
| Duration | 510.9s | **104.0s** | Keep ~**20%** of runtime as **one complete reel**, not 28–38s fragments |
| Speech density | ~70% | **~93%** | Strip silence, false starts, dead air aggressively |
| Long silences ≥0.5s | 98 (up to 6.75s) | **4** (max 0.5s) | Silence removal is core, not optional |
| Hard scene changes | ~0 | ~1 | Same setup; edits are **jump cuts**, not flashy scene transitions |
| Framing | looser / more of room | **tighter vertical talking-head** (576×1024) | Prefer mild punch-in / crop-in on face |
| Captions | n/a | **not always on-screen** | Emphasis is intermittent: **emoji overlays** + selective text, not constant karaoke walls |
| Overlays | none | **large contextual emojis** mid-chest on key beats | Effects serve meaning, sparsely |

## Editorial intent (product rules derived from this example)

1. **Understand the whole recording first**, then produce a **continuous coherent reel** (~90–120s soft target for this density of content).
2. **Retake cleanup**: when the speaker repeats the same idea, keep the strongest delivery only.
3. **Silence cleanup**: remove pauses that break energy; keep natural micro-pauses for breath.
4. **Visual language**:
   - Stay on the speaker (talking-head continuity)
   - Subtle zoom / punch-in on emphasis — not constant Ken Burns chaos
   - Occasional emoji/reaction overlays tied to what is being said
   - Avoid rainbow grade + constant xfade montage as the default “style”
5. **Five reels** (product goal) should each feel like *this*: a finished story unit — different angles/hooks on the same full understanding — not five short random montages.

## Anti-patterns (what our pipeline was doing wrong vs this reference)

- Packing 28–38s score-greedy fragments
- Heavy color-grade differences as the main “creative” differentiator
- Forced xfade between every clip
- Wall-to-wall burned captions even when the reference uses sparse overlays
- Dropping most of the argument to hit a short duration

## Next implementation levers

- Director soft target ≈ **90–110s** for documentary/complete-idea styles; allow longer if needed
- Prioritize **silence strip + retake collapse** before visual FX
- Add **emoji/reaction overlay** slots in EDL (content-triggered)
- Prefer **hard jump cuts** between takes; reserve xfade for true idea bridges
- Captions: phrase pops on key claims, not every word by default for this style family
