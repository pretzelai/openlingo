# Chat Voice Mode Switch (Text <-> Voice)

## Goal

Add a voice interaction mode to chat so the user can:

1. Speak to the app (audio -> text via Whisper)
2. Let the assistant answer normally (existing chat pipeline)
3. Hear the assistant response (text -> audio via OpenAI TTS)
4. Use custom VAD to auto-stop recording and submit after 2 seconds of silence

This should coexist with existing text chat mode and allow switching between modes.

---

## Codebase Research Findings

### 1) Current chat flow and where to integrate voice

- `components/chat/chat-view.tsx` is the core client chat UI and orchestration layer.
  - Uses `useChat` with `DefaultChatTransport` and `/api/chat` endpoint.
  - Handles send flow with `sendMessage({ text })` and persistence through `onFinish`.
  - Owns input box, model selector, loading states, and message rendering.
- This is the right place to add a mode switch and voice controls, because all send/receive state already lives here.

### 2) Existing STT/TTS capabilities already match user request

- Whisper STT already exists in `app/api/stt/route.ts` using:
  - `openai.audio.transcriptions.create({ model: "whisper-1", file, language })`
- OpenAI TTS already exists in `lib/tts.ts` and `app/api/tts/route.ts` using:
  - `openai.audio.speech.create({ model: "gpt-4o-mini-tts", voice: "coral", ... })`
  - Caching in DB + R2 via `audio_cache` table.
- Client-side audio playback helper already exists in `hooks/use-audio.ts` (`play`, `stop`, URL memoization).

Conclusion: STT and TTS are already implemented in project style. Voice chat can be built mostly as UI orchestration + VAD logic on top of existing endpoints.

### 3) Existing microphone capture pattern to reuse

- `components/exercises/speaking.tsx` already captures mic audio with `MediaRecorder` and posts `FormData` to `/api/stt`.
- It currently uses manual record/stop interaction (no VAD), and only sends audio after explicit stop.

Conclusion: we can reuse MediaRecorder/browser compatibility choices, but implement VAD from scratch for chat voice mode.

### 4) Existing assistant rendering and implications for TTS playback

- Assistant content is rendered from message `parts` (`components/chat/chat-message.tsx`), mainly `text` parts plus tool parts.
- Some assistant turns may include tool parts and markdown.

Implication: for voice playback we should extract assistant text parts only (ignore tool parts), and sanitize/truncate to avoid poor TTS output or endpoint length limits.

---

## Proposed Design

## A) Chat mode switch (text mode vs voice mode)

- Add local UI state in `ChatView`:
  - `interactionMode: "text" | "voice"` (default `"text"`)
- Add segmented toggle near model selector.
- Behavior:
  - **Text mode**: existing textarea + submit button behavior unchanged.
  - **Voice mode**: replace textarea form with voice control panel.

Reasoning: keeps current behavior stable and introduces voice with minimal disruption.

## B) Custom VAD (from scratch)

Implement in a dedicated hook (new file, likely `hooks/use-vad-recorder.ts`) using browser primitives only:

- Capture mic with `navigator.mediaDevices.getUserMedia({ audio: true })`.
- Create `AudioContext` + `AnalyserNode` and sample waveform each animation frame.
- Compute RMS from time-domain data as speech energy proxy.
- Track state machine:
  - `idle` -> `listening` once recording starts
  - `listening` records continuously and monitors speech/silence
  - `processing` after stop while transcribing
- VAD logic:
  - Maintain `speechStarted` flag once RMS crosses threshold.
  - Update `lastSpeechAt` whenever RMS is above threshold.
  - If `speechStarted` and silence duration >= 2000ms, auto-stop recorder.
- Stream-style chunking:
  - `mediaRecorder.start(250)` to emit `ondataavailable` chunks every ~250ms.
  - Keep appending chunks and merge to Blob on stop.

Recommended safeguards:

- Adaptive threshold from brief noise-floor sampling at start (improves reliability across devices).
- Hard max utterance duration (e.g. 30s) to avoid endless recording in noisy rooms.
- No-speech timeout (e.g. 8-10s) if user never starts talking.
- Full cleanup of tracks, AudioContext, RAF loop, timers on stop/unmount/mode switch.

## C) Voice turn pipeline (user speech -> chat -> assistant speech)

1. Start listening (voice mode mic button)
2. VAD auto-stops after 2s silence
3. Transcribe with existing `/api/stt` (Whisper)
4. Send transcript via existing `sendMessage({ text })`
5. Wait for assistant completion (`useChat` `onFinish`)
6. Extract latest assistant text and play via `useAudio().play(..., language)`

Implementation detail:

- Track `pendingVoiceReplyRef` to only auto-play replies triggered by voice turns.
- Do not auto-play historical messages or text-mode replies.

## D) UI/UX behavior

Voice mode panel in `ChatView` should include:

- Mic button (start/stop)
- Live status text: idle/listening/processing/sending/speaking/error
- Optional simple level indicator (driven by current RMS)
- Last transcript preview ("You said: ...")
- Disable mic while chat is currently streaming/submitted
- If playback is active and user starts a new recording, stop current playback first

This keeps the interaction clear and prevents overlapping audio/send flows.

---

## File-Level Plan

### 1) `components/chat/chat-view.tsx`

- Add mode state and UI toggle.
- Integrate new VAD recorder hook for voice capture/transcription.
- Keep existing text input branch intact.
- Add voice branch UI.
- Wire voice transcript to `sendMessage`.
- Extend `onFinish` to auto-play assistant response when turn was initiated by voice mode.

### 2) `hooks/use-vad-recorder.ts` (new)

- Own mic stream, MediaRecorder, analyser, RMS loop, silence detection, and cleanup.
- Expose:
  - control methods (`start`, `stop`, `cancel`)
  - state (`status`, `error`, `level`, `transcript`, `isRecording`, `isProcessing`)
  - callback/event when transcription is ready.
- Use existing `/api/stt` endpoint for Whisper transcription.

### 3) (Optional hardening) `app/api/stt/route.ts`

- Add defensive error handling and clearer errors so voice mode can surface friendly messages.
- Keep Whisper usage unchanged to stay aligned with project pattern.

---

## Edge Cases To Handle Carefully

1. Microphone permission denied or unavailable device
2. Browser without `MediaRecorder`/`AudioContext` support
3. User starts speaking very softly (threshold tuning/adaptation)
4. Background noise keeps VAD alive forever (max duration cutoff)
5. User says nothing (no-speech timeout with message)
6. Empty Whisper transcript (do not send empty chat message)
7. Assistant response too long for TTS input cap (trim before playback)
8. Assistant response with markdown/code blocks (strip/sanitize before TTS)
9. Rapid mode switches while recording (must cleanup stream/resources)
10. Prevent duplicate sends during in-flight requests

---

## Validation Plan

- Manual test text mode to ensure no regressions.
- Manual test voice mode happy path:
  - speak, pause >2s, transcript appears, assistant responds, audio plays.
- Test noisy room and silence-only scenarios.
- Test mobile browser behavior (permission flow + audio playback).
- Run type/lint/build checks with bun:
  - `bun run lint`
  - `bun run build`

---

## Implementation Todo

1. Add voice/text mode toggle UI in chat input area while preserving current text mode behavior.
2. Create `use-vad-recorder` hook with MediaRecorder + custom RMS-based VAD and 2s silence auto-stop.
3. Stream-record chunks (`start(250)`), merge on stop, call `/api/stt`, and expose transcript + status.
4. Wire transcript submission into existing `sendMessage` flow with duplicate-send protection.
5. Auto-play assistant reply for voice turns using existing `/api/tts` via `useAudio`.
6. Add cleanup/error handling for permissions, unsupported APIs, and mode switches.
7. Run `bun run lint` and `bun run build`, fix any issues, and verify text mode still works.
