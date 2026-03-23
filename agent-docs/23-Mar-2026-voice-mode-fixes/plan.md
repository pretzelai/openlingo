## Goal

Fix the review findings on `cord/enormous-tiglon-5a7c` so the new voice mode is safer to ship.

## What I found

- `hooks/use-vad-recorder.ts` has a cancel-path state bug: `cancel()` invalidates the active cycle before `MediaRecorder.onstop` runs, so `onstop` exits early and skips the normal `cancel` cleanup. In `ChatView`, switching from voice mode back to text triggers this path.
- The upload path preserves the blob MIME type but not the filename/container extension. The client appends a bare blob, while the server wraps it as `recording.webm`, which is brittle when browsers emit non-WebM audio.
- The VAD warmup phase updates the adaptive noise floor during the first 700ms even when the user is already speaking, which can inflate the threshold and cause false `no-speech` outcomes.
- There is existing Bun-based test coverage elsewhere in the repo (`bun:test`), but no `test` script in `package.json` and no voice/VAD-specific automated coverage.

## Design decisions

1. Keep the active recording cycle intact until the recorder has fully stopped when handling `cancel` during recording. Only invalidate the cycle immediately when canceling after recording has already ended (for example while transcription is processing).
2. Add a small shared audio/VAD utility module that:
   - derives a safe filename/extension from MIME type,
   - normalizes uploaded audio into a `File`,
   - encapsulates the VAD warmup/noise-floor logic in pure functions that are easy to test.
3. Update both client and server to preserve the real audio container end-to-end.
4. Add focused Bun tests for the MIME/filename handling and warmup VAD classification, and expose them via `bun run test`.

## Edge cases to watch

- Cancel while actively recording versus cancel while already processing.
- Browsers that emit `audio/mp4`, `audio/m4a`, `audio/mp4;codecs=mp4a.40.2`, `audio/ogg`, or `audio/webm;codecs=opus`.
- Loud initial speech during VAD warmup should be treated as speech without contaminating the learned noise floor.
- Quiet warmup samples should still calibrate the threshold upward gradually.

## Todo

1. Add shared audio/VAD helpers and tests.
2. Patch the recorder hook to use the helper logic and fix cancel-cycle handling.
3. Patch the STT upload flow to preserve actual container filenames.
4. Add a `test` script and run Bun tests/type checks.
