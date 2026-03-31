import type { Env } from "../types";

function requireBucket(env: Env) {
  if (!env.AUDIO_BUCKET) {
    throw new Error("AUDIO_BUCKET binding is required for audio features");
  }
  return env.AUDIO_BUCKET;
}

export async function uploadAudio(env: Env, key: string, bytes: Uint8Array | ArrayBuffer) {
  const bucket = requireBucket(env);
  await bucket.put(key, bytes, {
    httpMetadata: { contentType: "audio/mpeg" },
  });
}

export async function getAudio(env: Env, key: string): Promise<ArrayBuffer | null> {
  const bucket = requireBucket(env);
  const object = await bucket.get(key);
  return object ? object.arrayBuffer() : null;
}

export function getPublicUrl(key: string) {
  return `/api/tts?key=${encodeURIComponent(key)}`;
}
