/** 원문 계열 암호화 테스트 — 담당: D. 저장되는 값에 원문이 그대로 남지 않아야 한다. */
import { createCipheriv, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CryptoError, open, seal, type Sealed } from "@/lib/crypto";
import { garam4 } from "@/lib/fixture";

const KEY = randomBytes(32).toString("base64");
const CANARY = "CANARY-7F3A 저녁 52,001원";

afterEach(() => vi.unstubAllEnvs());

describe("crypto (키 있음)", () => {
  it("암호화 후 복호화하면 원래 값", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    const s = seal(garam4.masked);
    expect(s.alg).toBe("aes-256-gcm");
    expect(open(s)).toEqual(garam4.masked);
  });

  it("암호문에 원문이 보이지 않고, 매번 다른 iv를 쓴다", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    const a = seal({ text: CANARY });
    const b = seal({ text: CANARY });
    expect(JSON.stringify(a)).not.toContain("CANARY");
    expect(Buffer.from(a.data, "base64").toString("utf8")).not.toContain("CANARY");
    expect(a.data).not.toBe(b.data);
  });

  it("변조하면 복호화 실패", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    const s = seal({ text: CANARY });
    const buf = Buffer.from(s.data, "base64");
    buf[buf.length - 1] ^= 0x01;
    expect(() => open({ alg: s.alg, data: buf.toString("base64") })).toThrow(/복호화에 실패/);
  });

  it("다른 키로는 복호화 실패", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    const s = seal({ text: CANARY });
    vi.stubEnv("ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    expect(() => open(s)).toThrow(/복호화에 실패/);
  });

  it("키 길이가 32바이트가 아니면 거절하고, 오류에 키 값이 없다", () => {
    const bad = randomBytes(16).toString("base64");
    vi.stubEnv("ENCRYPTION_KEY", bad);
    expect(() => seal("x")).toThrow(/32바이트/);
    try {
      seal("x");
    } catch (e) {
      expect(String(e)).not.toContain(bad);
    }
  });

  it("짧은 암호문은 형식 오류", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    expect(() => open({ alg: "aes-256-gcm", data: "AAAA" })).toThrow(/형식/);
  });

  it("앞뒤 줄바꿈·공백만 있는 키는 허용 (비밀 파일 끝 줄바꿈)", () => {
    vi.stubEnv("ENCRYPTION_KEY", ` ${KEY}\n`);
    const s = seal({ a: 1 });
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    expect(open(s)).toEqual({ a: 1 });
  });
});

describe("ENCRYPTION_KEY 형식 검사", () => {
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  // 32바이트 → 43자 + "=". 마지막 문자의 하위 2비트는 패딩 비트라 바꿔도 같은 바이트로 디코딩된다(비정규 표현).
  const last = KEY[42];
  const nonCanonical = KEY.slice(0, 42) + B64[B64.indexOf(last) ^ 0b01] + "=";

  const bad: Record<string, string> = {
    "중간에 잘못된 문자": KEY.slice(0, 20) + "!" + KEY.slice(20),
    "중간에 공백": KEY.slice(0, 20) + " " + KEY.slice(20),
    "패딩 누락": KEY.replace(/=$/, ""),
    "base64url 문자": "-_" + KEY.slice(2),
    "비정규 패딩 비트": nonCanonical,
    "hex 64자": randomBytes(32).toString("hex"),
  };

  for (const [name, value] of Object.entries(bad)) {
    it(`거절: ${name}`, () => {
      vi.stubEnv("ENCRYPTION_KEY", value);
      expect(() => seal("x")).toThrow(CryptoError);
      expect(() => seal("x")).toThrow(/ENCRYPTION_KEY/);
      // 오류 메시지·문자열 표현에 키 값이 들어가지 않는다
      const e = catchError(() => seal("x"));
      expect(`${e} ${e.stack}`).not.toContain(value.trim());
    });
  }

  it("형식은 맞지만 32바이트가 아니면 길이 오류", () => {
    vi.stubEnv("ENCRYPTION_KEY", randomBytes(24).toString("base64"));
    expect(() => seal("x")).toThrow(/32바이트/);
  });

  it("키 형식이 틀리면 복호화도 거절", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    const s = seal({ a: 1 });
    vi.stubEnv("ENCRYPTION_KEY", bad["중간에 잘못된 문자"]);
    expect(() => open(s)).toThrow(/base64/);
  });
});

describe("crypto (키 없음)", () => {
  it("로컬(memory)에서는 평문으로 감싸고 다시 읽는다", () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    vi.stubEnv("STORE", "memory");
    const s = seal({ a: 1 });
    expect(s.alg).toBe("none");
    expect(open(s)).toEqual({ a: 1 });
  });

  it("운영(redis)에서는 키 없이 저장하지 않는다", () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    vi.stubEnv("STORE", "redis");
    expect(() => seal({ a: 1 })).toThrow(/ENCRYPTION_KEY/);
  });

  it("운영(redis)에서는 평문 레코드를 읽지 않는다", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    vi.stubEnv("STORE", "redis");
    const plain: Sealed = { alg: "none", data: JSON.stringify({ a: 1 }) };
    expect(() => open(plain)).toThrow(/평문/);
  });
});

describe("crypto (NODE_ENV=production)", () => {
  for (const store of ["memory", "redis", ""]) {
    it(`STORE=${store || "(없음)"}이어도 키가 없으면 seal·open 모두 거부`, () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("STORE", store);
      vi.stubEnv("ENCRYPTION_KEY", "");
      expect(() => seal({ a: 1 })).toThrow(/ENCRYPTION_KEY/);
      expect(() => open({ alg: "none", data: JSON.stringify({ a: 1 }) })).toThrow(/평문/);
      expect(() => open({ alg: "aes-256-gcm", data: "A".repeat(64) })).toThrow(/ENCRYPTION_KEY/);
    });
  }

  it("키가 있으면 memory 저장소에서도 암호화한다", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STORE", "memory");
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    const s = seal({ a: 1 });
    expect(s.alg).toBe("aes-256-gcm");
    expect(open(s)).toEqual({ a: 1 });
  });

  it("키가 있어도 평문 레코드는 읽지 않는다", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STORE", "memory");
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    expect(() => open({ alg: "none", data: JSON.stringify({ a: 1 }) })).toThrow(/평문/);
  });
});

describe("손상 레코드와 오류 메시지 (CANARY 노출 방지)", () => {
  it("손상된 평문 레코드는 CryptoError, 메시지에 원문 없음", () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    vi.stubEnv("STORE", "memory");
    const e = catchError(() => open({ alg: "none", data: `${CANARY} 깨진 JSON` }));
    expect(e).toBeInstanceOf(CryptoError);
    expect(`${e} ${e.stack}`).not.toContain("CANARY");
    expect(e.cause).toBeUndefined();
  });

  it("복호화는 됐지만 JSON이 아닌 경우도 CryptoError, 메시지에 원문 없음", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    // 같은 키로 JSON이 아닌 바이트를 직접 암호화해 넣는다
    const key = Buffer.from(KEY, "base64");
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", key, iv);
    const body = Buffer.concat([c.update(`${CANARY} not json`, "utf8"), c.final()]);
    const data = Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
    const e = catchError(() => open({ alg: "aes-256-gcm", data }));
    expect(e).toBeInstanceOf(CryptoError);
    expect(`${e} ${e.stack}`).not.toContain("CANARY");
  });

  it("모든 실패 경로의 오류에 CANARY·키가 없다", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    const s = seal({ text: CANARY });
    const tampered = Buffer.from(s.data, "base64");
    tampered[tampered.length - 1] ^= 0x01;
    const errors: Error[] = [
      catchError(() => open({ alg: s.alg, data: tampered.toString("base64") })),
      catchError(() => open({ alg: "rot13" as Sealed["alg"], data: s.data })),
      catchError(() => open({ alg: s.alg, data: "AAAA" })),
    ];
    vi.stubEnv("ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    errors.push(catchError(() => open(s)));
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENCRYPTION_KEY", "");
    errors.push(catchError(() => seal({ text: CANARY })));
    errors.push(catchError(() => open({ alg: "none", data: JSON.stringify({ text: CANARY }) })));

    for (const e of errors) {
      expect(e).toBeInstanceOf(CryptoError);
      const shown = `${e} ${e.stack} ${JSON.stringify(e)}`;
      expect(shown).not.toContain("CANARY");
      expect(shown).not.toContain(KEY);
    }
  });
});

function catchError(fn: () => unknown): Error {
  try {
    fn();
  } catch (e) {
    return e as Error;
  }
  throw new Error("예외가 발생하지 않았습니다");
}
