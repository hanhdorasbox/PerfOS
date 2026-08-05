# 🎸 Acoustic Arranger

A self-contained feature that turns a plain single-note melody into a fuller,
**physically playable** acoustic guitar arrangement — then lets you hear it,
see it on a synced fretboard, edit it, and export it. Everything runs
client-side (no backend, no external samples), so it works offline and inside a
strict CSP.

Route: **`/guitar`** → `app/guitar/page.tsx` → `components/guitar/GuitarArranger.tsx`.

## Architecture

The engine is a hybrid of deterministic music theory and playability rules —
never an LLM guessing tab. It lives in `lib/guitar/` as pure, unit-tested
TypeScript (`lib/guitar/engine.test.ts`, run with `vitest run lib/guitar`).

| Layer | File | Responsibility |
| --- | --- | --- |
| Types | `types.ts` | `TabNote`, `Chord`, `Key`, `Arrangement`, options. Pitch = MIDI int; duration = quarter-note beats. |
| Theory | `theory.ts` | Krumhansl-Schmuckler key detection, scales, chord dictionary, melody-driven **harmoniser** (ranked chord choices per bar). |
| Fretboard | `fretboard.ts` | Tunings, capo, pitch↔position mapping, and cost-based position/voicing selection (open strings, low hand travel, melody kept on top). |
| Parser | `tab.ts` | ASCII six-line tab → rhythmic melody (rhythm inferred from horizontal spacing); structured notes → clean tab. |
| Arranger | `arranger.ts` | Styles × difficulty × 5 variants. Preserves the melody; adds bass, chord tones, arpeggios, syncopation, percussion, hammer/pull. Validates every note is reachable. |
| Export | `export.ts` | Standard MIDI File + MusicXML. |
| Audio | `audio.ts` | Karplus-Strong plucked-string synth + body resonance + room reverb (Web Audio). |

UI pieces in `components/guitar/`:

- **`GuitarArranger.tsx`** — the whole tool: input, settings, version picker,
  transport, note editing, chord cycling, exports.
- **`useGuitarPlayer.ts`** — lookahead Web-Audio scheduler with a reactive
  `currentBeat` for highlighting; loop / solo / mute / metronome / count-in.
- **`TabView.tsx`** — interactive tab with per-note highlight, seek-on-click.
- **`Fretboard.tsx`** — synced neck showing the notes sounding right now.

## Design principle

The original **melody is sacred**: its pitch and rhythm are preserved
(strictness `exact`). Everything else is added *around* it and checked for
reachability before it lands in the tab — so the result sounds convincing on a
real steel-string acoustic without effects.
