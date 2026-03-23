import { describe, expect, test } from "bun:test";
import {
  analyzeVADSample,
  getAudioUploadFilename,
  getSpeechThreshold,
  normalizeUploadedAudioFile,
  updateWarmupNoiseFloor,
} from "./voice";

describe("audio upload filenames", () => {
  test("preserves webm filenames for opus recordings", () => {
    expect(getAudioUploadFilename("audio/webm;codecs=opus")).toBe("recording.webm");
  });

  test("maps mp4-family audio to a matching extension", () => {
    expect(getAudioUploadFilename("audio/mp4;codecs=mp4a.40.2")).toBe("recording.mp4");
    expect(getAudioUploadFilename("audio/x-m4a")).toBe("recording.m4a");
  });

  test("normalizes unnamed blobs with a derived filename", () => {
    const blob = new Blob(["audio"], { type: "audio/mp4" });
    const file = normalizeUploadedAudioFile(blob);

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("recording.mp4");
    expect(file.type).toBe("audio/mp4");
  });

  test("keeps explicit filenames from the client", () => {
    const file = new File(["audio"], "voice-note.m4a", { type: "audio/x-m4a" });

    expect(normalizeUploadedAudioFile(file)).toBe(file);
  });
});

describe("VAD warmup analysis", () => {
  test("treats loud speech during warmup as speech without learning it as noise", () => {
    const result = analyzeVADSample({
      rms: 0.07,
      elapsedMs: 120,
      noiseFloor: 0,
      speechStarted: false,
    });

    expect(result.speechDetected).toBe(true);
    expect(result.nextNoiseFloor).toBe(0);
    expect(result.threshold).toBe(getSpeechThreshold(0));
  });

  test("learns quiet warmup samples gradually", () => {
    const nextNoiseFloor = updateWarmupNoiseFloor(0, 0.008);

    expect(nextNoiseFloor).toBeCloseTo(0.008, 6);
    expect(getSpeechThreshold(nextNoiseFloor)).toBeGreaterThan(0.018);
  });

  test("caps warmup calibration so louder background does not explode the threshold", () => {
    const result = analyzeVADSample({
      rms: 0.03,
      elapsedMs: 200,
      noiseFloor: 0,
      speechStarted: false,
    });

    expect(result.speechDetected).toBe(false);
    expect(result.nextNoiseFloor).toBeLessThan(0.018);
    expect(result.threshold).toBeLessThan(0.04);
  });
});
