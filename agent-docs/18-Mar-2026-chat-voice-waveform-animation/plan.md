# Chat Voice Waveform Animation Plan

## Goal

Add a visually engaging, oscillating waveform in chat voice mode that reacts to live mic input while recording, and becomes flat when there is no meaningful incoming audio.

## Codebase Research Findings

### 1) Current voice chat UI location and rendering flow

- `components/chat/chat-view.tsx` owns the full chat input area (text mode and voice mode switch), including the existing voice controls.
- Voice mode currently renders:
  - microphone button (`handleVoiceButton`)
  - status label (`getVoiceStatusLabel`)
  - helper text
  - a simple horizontal level meter (`w-20` progress bar using `voiceLevel` width)
- This is the exact place where waveform UI should replace (or augment) the current level meter so the feature appears directly in chat where users already interact with voice mode.

### 2) Live audio signal source already exists

- `hooks/use-vad-recorder.ts` computes RMS from `AnalyserNode.getByteTimeDomainData()` every animation frame.
- It exposes `level` (0..1-ish clamped) and updates it at ~80ms cadence.
- `level` is already wired into `ChatView` as `voiceLevel`.
- Recording status is available as `isRecording: status === "listening"` and processing status as `isProcessing`.

This means we do not need to add a new microphone pipeline; we can build the waveform with current data.

### 3) Why current meter does not satisfy the request

- Existing UI only shows a linear width bar, not an oscillating waveform.
- It does not feel “cool” or animated beyond width transitions.
- It can show tiny movement due to ambient noise because there is no explicit display-floor/gating in UI.

### 4) Styling/animation conventions in this repo

- Global animations live in `app/globals.css` (`@keyframes` + utility classes).
- Most UI styling is Tailwind utility classes inline in components.
- Existing chat code favors compact, self-contained client components.

This supports introducing a small dedicated `VoiceWaveform` component with either:
- local `requestAnimationFrame` time progression, and/or
- global keyframes in `globals.css` for a reusable waveform pulse effect.

## Proposed Design

## A) Add a reusable waveform component

Create `components/chat/voice-waveform.tsx` with props like:

- `level: number` (from VAD)
- `active: boolean` (`isVoiceRecording` and not disabled)
- optional `className`

Rendering approach:

- Build 12-20 vertical bars inside a fixed-width container.
- Each bar has a different phase/weight to create a wave pattern.
- Compute bar height from two factors:
  1. **audio amplitude** derived from `level`
  2. **oscillation factor** derived from `time + phase`
- Use `requestAnimationFrame` while active to advance time and produce smooth motion.

Flat-without-audio behavior:

- Apply an audio gate in component logic:
  - `effectiveLevel = max(0, level - VISUAL_NOISE_FLOOR)`
  - if below a small threshold, render all bars at baseline height (flat line)
- Keep oscillation contribution multiplied by `effectiveLevel`, so no audio -> zero oscillation.

## B) Integrate into chat voice panel

In `components/chat/chat-view.tsx`:

- Import and render `VoiceWaveform` where current `w-20` level bar is.
- Pass `level={voiceLevel}` and `active={isVoiceRecording}`.
- Preserve existing status text and transcript/error sections.
- Keep mic button/disable logic unchanged.

## C) Minimal, safe VAD hook updates (only if needed)

Expected default: no hook API changes required.

Optional fallback if flatness is not reliable in noisy environments:

- Add a derived boolean from hook (e.g., `isSignalActive`) based on `rms > threshold` with short smoothing.
- Use that boolean to gate waveform animation more decisively.

I will start without hook API changes to keep scope minimal and reduce regression risk.

## D) Visual behavior details

- During active speech: bars animate with staggered heights and smooth transitions.
- During silence while recording: bars collapse to a low flat baseline.
- While not recording: keep waveform static and subdued (flat), or hidden depending on available space.
- Use existing palette (`lingo-blue` family) to stay consistent with current chat visuals.

## Edge Cases To Handle

1. **Ambient mic noise** causing tiny non-zero levels: clamp with visual noise floor to keep near-flat silence.
2. **Rapid start/stop recording**: ensure rAF loop in waveform component cleans up on unmount/active false.
3. **Processing state** (`isVoiceProcessing`): waveform should not look “live listening”; keep flat/static.
4. **Disabled voice button** while busy: waveform should still render predictably (no jitter).
5. **Mobile layout constraints**: waveform width should not crowd status text or push controls off-screen.

## Validation Plan

- Manual UI verification in chat voice mode:
  - No audio/no speaking: waveform appears flat.
  - Speaking softly/loudly: waveform amplitude scales up/down with input.
  - Stop recording and processing: waveform returns to flat/static state.
- Regression check chat text mode unchanged.
- Run project checks with bun:
  - `bun run lint`
  - `bun run build`

## Implementation Todo

1. Create `components/chat/voice-waveform.tsx` with bar-based oscillating waveform and audio-gated flat state.
2. Replace current simple voice level progress meter in `components/chat/chat-view.tsx` with `VoiceWaveform`.
3. Tune thresholds/baseline so silence is visually flat but speech remains responsive.
4. Verify responsive layout in the existing chat voice row (desktop and mobile widths).
5. Run `bun run lint` and `bun run build`, then fix any issues.
