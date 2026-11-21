/**
 * 저장소 — 담당: D (구현계획서 6장 '저장소')
 *
 * STORE=memory : 로컬 개발용. 프로세스 메모리에 TTL과 함께 저장 (서버 재시작하면 사라짐)
 * STORE=redis  : 운영. 네이버 클라우드 Cloud DB for Cache (REDIS_URL, 사설망)
 *
 * 보관 기간: 원문 계열(excerpt·extract·confirm)은 마지막 수정 후 7일, 결과(version)는 확정 후 30일.
 * 원문 계열 키는 백업 대상에서 뺀다.
 */
import { Redis } from "ioredis";
import { env } from "./env";
import { log } from "./log";

export interface Store {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
}

const DAY = 24 * 60 * 60;
export const TTL = {
  /** 원문·근거·확인값: 마지막 수정 후 7일 (수정할 때마다 다시 건다) */
  source: 7 * DAY,
  /** 판·결과 링크: 확정 후 30일 */
  result: 30 * DAY,
} as const;

export const keys = {
  event: (id: string) => `event:${id}`,
  adminToken: (hash: string) => `atoken:${hash}`,
  resultToken: (hash: string) => `rtoken:${hash}`,
  excerpt: (id: string) => `excerpt:${id}`,
  extract: (id: string) => `extract:${id}`,
  confirm: (id: string) => `confirm:${id}`,
  version: (id: string, n: number) => `version:${id}:${n}`,
  latestVersion: (id: string) => `version:${id}:latest`,
};

type Entry = { value: unknown; expiresAt: number };
const g = globalThis as unknown as { __daechongStore?: Map<string, Entry> };

class MemoryStore implements Store {
  // dev 서버 핫 리로드에도 유지되도록 globalThis에 둔다
  private map: Map<string, Entry> = (g.__daechongStore ??= new Map());

  async get<T>(key: string): Promise<T | null> {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.expiresAt < Date.now()) {
      this.map.delete(key);
      return null;
    }
    return structuredClone(e.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.map.set(key, { value: structuredClone(value), expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(...ks: string[]): Promise<void> {
    for (const k of ks) this.map.delete(k);
  }
}

/** 저장소 오류. 메시지에 키 값·저장 값·접속 주소(비밀번호 포함 가능)를 넣지 않는다. */
export class StoreError extends Error {
  override name = "StoreError";
}

const ERROR_LOG_INTERVAL_MS = 30_000;

/**
 * 운영 저장소 — Cloud DB for Cache (Redis). 값은 JSON 문자열, TTL은 "SET key value EX ttl".
 * REDIS_URL 예: redis://10.0.1.5:6379, 비밀번호가 있으면 redis://:비밀번호@10.0.1.5:6379, TLS면 rediss://
 */
export class RedisStore implements Store {
  private client: Redis;
  private lastErrorLogAt = 0;

  constructor(url: string | undefined = process.env.REDIS_URL) {
    if (!url?.trim()) throw new StoreError("STORE=redis인데 REDIS_URL이 없습니다");
    this.client = new Redis(url.trim(), {
      // 연결이 끊겼을 때 요청이 오래 매달리지 않게 한다 (API는 바로 500으로 실패)
      maxRetriesPerRequest: 2,
      connectTimeout: 5_000,
    });
    // 재연결 중에는 오류가 반복되므로 30초에 한 번만, 오류 종류만 남긴다 (메시지에 주소가 들어갈 수 있음)
    this.client.on("error", (e: Error & { code?: string }) => {
      const now = Date.now();
      if (now - this.lastErrorLogAt < ERROR_LOG_INTERVAL_MS) return;
      this.lastErrorLogAt = now;
      log.warn("redis_error", { reason: e.code ?? e.name });
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // SyntaxError 메시지에는 저장 값 일부가 들어가므로 원인을 버린다
      throw new StoreError("저장된 값의 형식이 올바르지 않습니다");
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const json = JSON.stringify(value);
    if (json === undefined) throw new StoreError("저장할 수 없는 값입니다");
    // Redis EX는 1 이상의 정수 초
    const ttl = Math.max(1, Math.ceil(ttlSeconds));
    await this.client.set(key, json, "EX", ttl);
  }

  async del(...ks: string[]): Promise<void> {
    if (ks.length === 0) return;
    await this.client.del(...ks);
  }

  /** 연결 종료 (테스트·종료 처리용) */
  async close(): Promise<void> {
    await this.client.quit().catch(() => this.client.disconnect());
  }
}

// dev 서버 핫 리로드 때 Redis 연결이 쌓이지 않도록 globalThis에 하나만 둔다
const gs = globalThis as unknown as { __daechongStoreInstance?: Store };
export function getStore(): Store {
  gs.__daechongStoreInstance ??= env.store === "redis" ? new RedisStore() : new MemoryStore();
  return gs.__daechongStoreInstance;
}
