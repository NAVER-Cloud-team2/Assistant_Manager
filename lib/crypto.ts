/**
 * 원문 계열 암호화 — 담당: D (구현계획서 7장: AES-GCM, 키는 ENCRYPTION_KEY / Secret Manager)
 *
 * - ENCRYPTION_KEY(32바이트, 표준 base64)가 있으면 항상 AES-256-GCM으로 감싼다.
 * - 평문(alg "none")은 "개발용 메모리 모드"에서만 허용한다:
 *     NODE_ENV !== "production" 이고 STORE=memory 일 때.
 *   그 밖(운영 빌드, 또는 STORE=redis)에서는 키가 없으면 seal·open 모두 거부하고, 평문 레코드도 읽지 않는다.
 *
 * data 형식: base64( iv(12바이트) | authTag(16바이트) | 암호문 )
 * 오류 메시지에는 키·평문·암호문을 넣지 않는다. 내부 예외(JSON.parse 등)는 원인 없이 CryptoError로 바꾼다.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

export interface Sealed {
  alg: "none" | "aes-256-gcm";
  data: string;
}

const ALG = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** 표준 base64(RFC 4648 4장): + / 문자, 패딩 필수, 중간 공백 없음 */
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export class CryptoError extends Error {
  override name = "CryptoError";
}

/** 평문 감싸기를 허용하는 유일한 경우: 개발·테스트 빌드 + 메모리 저장소 */
function plaintextAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && env.store === "memory";
}

/** 비밀값은 env.ts에 노출하지 않고 여기서 직접 읽는다. 오류 메시지에 값을 넣지 않는다. */
function loadKey(): Buffer | null {
  // 비밀 파일·Secret Manager 값 끝의 줄바꿈은 흔하므로 앞뒤 공백만 허용한다
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  if (!BASE64.test(raw)) {
    throw new CryptoError("ENCRYPTION_KEY가 표준 base64 형식이 아닙니다 (openssl rand -base64 32 로 만드세요)");
  }
  const key = Buffer.from(raw, "base64");
  // 패딩 직전 비트가 0이 아닌 비정규 표현은 같은 바이트로 디코딩되지만 오타일 수 있어 거절한다
  if (key.toString("base64") !== raw) {
    throw new CryptoError("ENCRYPTION_KEY가 표준 base64 형식이 아닙니다 (openssl rand -base64 32 로 만드세요)");
  }
  if (key.length !== KEY_BYTES) {
    throw new CryptoError("ENCRYPTION_KEY는 32바이트 값을 base64로 인코딩한 것이어야 합니다");
  }
  return key;
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    // SyntaxError 메시지에는 입력 앞부분이 들어가므로 원인을 버린다
    throw new CryptoError("저장된 레코드 형식이 올바르지 않습니다");
  }
}

export function seal(value: unknown): Sealed {
  const key = loadKey();
  if (!key) {
    if (!plaintextAllowed()) {
      throw new CryptoError("ENCRYPTION_KEY가 없어 원문 계열 데이터를 저장할 수 없습니다");
    }
    return { alg: "none", data: JSON.stringify(value) };
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { alg: ALG, data: Buffer.concat([iv, tag, body]).toString("base64") };
}

export function open<T>(sealed: Sealed): T {
  if (sealed.alg === "none") {
    if (!plaintextAllowed()) throw new CryptoError("운영 환경에서는 평문 레코드를 읽지 않습니다");
    return parseJson<T>(sealed.data);
  }
  if (sealed.alg !== ALG) throw new CryptoError("알 수 없는 암호화 방식입니다");

  const key = loadKey();
  if (!key) throw new CryptoError("ENCRYPTION_KEY가 없어 복호화할 수 없습니다");
  const buf = Buffer.from(sealed.data, "base64");
  if (buf.length < IV_BYTES + TAG_BYTES) throw new CryptoError("암호문 형식이 올바르지 않습니다");

  let plain: Buffer;
  try {
    const decipher = createDecipheriv(ALG, key, buf.subarray(0, IV_BYTES));
    decipher.setAuthTag(buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    plain = Buffer.concat([decipher.update(buf.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
  } catch {
    // 키가 다르거나 변조된 경우. 원인 상세(암호문 등)는 남기지 않는다.
    throw new CryptoError("복호화에 실패했습니다 (키 불일치 또는 변조)");
  }
  return parseJson<T>(plain.toString("utf8"));
}
