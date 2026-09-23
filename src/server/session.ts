import { createHmac, timingSafeEqual } from "node:crypto";

type Payload = { userId: string; exp: number };

export function signSession(userId: string, secret: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ userId, exp: now + 14 * 24 * 60 * 60 * 1000 } satisfies Payload)).toString(
    "base64url",
  );
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readSession(token: string | undefined, secret: string, now = Date.now()): string | null {
  if (!token || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (!payload.userId || payload.exp < now) return null;
    return payload.userId;
  } catch {
    return null;
  }
}
