import { HTTPException } from "hono/http-exception";

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function requireParam(value: string | undefined, message: string) {
  if (!value) {
    throw new HTTPException(400, { message });
  }
  return value;
}

export async function safeJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}
