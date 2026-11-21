/**
 * 원문 계열 암호화 — 담당: D (구현계획서 7장: AES-GCM, 키는 ENCRYPTION_KEY / Secret Manager)
 *
 * 지금은 로컬 메모리 저장소 전용으로 평문을 감싸기만 한다.
 * 운영(STORE=redis)에서 평문으로 저장되는 일을 막기 위해, 구현 전에는 seal이 오류를 던진다.
 */
import { env } from "./env";
import { NotImplementedError } from "./errors";

export interface Sealed {
  alg: "none" | "aes-256-gcm";
  data: string;
}

export function seal(value: unknown): Sealed {
  if (env.store === "redis") {
    // TODO(D): ENCRYPTION_KEY로 AES-256-GCM (iv 12바이트, authTag 포함) 구현
    throw new NotImplementedError("seal — TODO(D): 운영 저장 전 AES-GCM 구현 필요");
  }
  return { alg: "none", data: JSON.stringify(value) };
}

export function open<T>(sealed: Sealed): T {
  if (sealed.alg !== "none") {
    throw new NotImplementedError("open — TODO(D): AES-GCM 복호화");
  }
  return JSON.parse(sealed.data) as T;
}
