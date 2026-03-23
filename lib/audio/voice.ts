export const MIN_VAD_THRESHOLD = 0.018;
export const VAD_WARMUP_MS = 700;

const WARMUP_SPEECH_MULTIPLIER = 2.5;
const MAX_WARMUP_NOISE_FLOOR = MIN_VAD_THRESHOLD * 0.7;

export interface AnalyzeVADSampleInput {
  rms: number;
  elapsedMs: number;
  noiseFloor: number;
  speechStarted: boolean;
}

export interface AnalyzeVADSampleResult {
  nextNoiseFloor: number;
  threshold: number;
  speechDetected: boolean;
}

export function getSpeechThreshold(noiseFloor: number) {
  return Math.max(MIN_VAD_THRESHOLD, noiseFloor * 3);
}

export function updateWarmupNoiseFloor(noiseFloor: number, rms: number) {
  const boundedSample = Math.min(rms, MAX_WARMUP_NOISE_FLOOR);
  return noiseFloor === 0 ? boundedSample : noiseFloor * 0.9 + boundedSample * 0.1;
}

export function analyzeVADSample({
  rms,
  elapsedMs,
  noiseFloor,
  speechStarted,
}: AnalyzeVADSampleInput): AnalyzeVADSampleResult {
  const inWarmup = !speechStarted && elapsedMs < VAD_WARMUP_MS;

  if (inWarmup) {
    const warmupSpeechThreshold = Math.max(
      MIN_VAD_THRESHOLD * WARMUP_SPEECH_MULTIPLIER,
      getSpeechThreshold(noiseFloor) * 1.25,
    );

    if (rms >= warmupSpeechThreshold) {
      return {
        nextNoiseFloor: noiseFloor,
        threshold: getSpeechThreshold(noiseFloor),
        speechDetected: true,
      };
    }

    const nextNoiseFloor = updateWarmupNoiseFloor(noiseFloor, rms);
    return {
      nextNoiseFloor,
      threshold: getSpeechThreshold(nextNoiseFloor),
      speechDetected: rms > getSpeechThreshold(nextNoiseFloor),
    };
  }

  return {
    nextNoiseFloor: noiseFloor,
    threshold: getSpeechThreshold(noiseFloor),
    speechDetected: rms > getSpeechThreshold(noiseFloor),
  };
}

export function getAudioExtension(mimeType?: string | null) {
  const normalized = mimeType?.split(";")[0]?.trim().toLowerCase();

  switch (normalized) {
    case "audio/webm":
      return "webm";
    case "audio/mp4":
      return "mp4";
    case "audio/x-m4a":
    case "audio/m4a":
      return "m4a";
    case "audio/mpeg":
      return "mp3";
    case "audio/ogg":
      return "ogg";
    case "audio/wav":
    case "audio/wave":
    case "audio/vnd.wave":
      return "wav";
    case "audio/aac":
      return "aac";
    default:
      return "webm";
  }
}

export function getAudioUploadFilename(mimeType?: string | null, baseName = "recording") {
  return `${baseName}.${getAudioExtension(mimeType)}`;
}

export function normalizeUploadedAudioFile(audio: Blob): File {
  const filename =
    audio instanceof File && audio.name && audio.name !== "blob"
      ? audio.name
      : getAudioUploadFilename(audio.type);

  if (audio instanceof File && audio.name === filename) {
    return audio;
  }

  return new File([audio], filename, {
    type: audio.type || "audio/webm",
  });
}
