/**
 * id·토큰 — 담당: D
 * 토큰은 128비트 무작위(base64url). 저장소에는 해시만 둔다. 토큰을 로그에 남기지 않는다.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const newId = (): string => randomBytes(9).toString("base64url");
export const newToken = (): string => randomBytes(16).toString("base64url");
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}
