/**
 * 저장소 — 담당: D (구현계획서 6장 '저장소')
 *
 * STORE=memory : 로컬 개발용. 프로세스 메모리에 TTL과 함께 저장 (서버 재시작하면 사라짐)
 * STORE=redis  : 운영. 네이버 클라우드 Cloud DB for Cache (REDIS_URL, 사설망)
 *
 * 보관 기간: 원문 계열(excerpt·extract·confirm)은 마지막 수정 후 7일, 결과(version)는 확정 후 30일.
 * 원문 계열 키는 백업 대상에서 뺀다.
 */
import { env } from "./env";
import { NotImplementedError } from "./errors";

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

class RedisStore implements Store {
  // TODO(D): ioredis 등으로 REDIS_URL에 연결. set은 "SET key value EX ttl", 값은 JSON 문자열.
  async get<T>(key: string): Promise<T | null> {
    void key;
    throw new NotImplementedError("RedisStore.get — TODO(D)");
  }
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    void key;
    void value;
    void ttlSeconds;
    throw new NotImplementedError("RedisStore.set — TODO(D)");
  }
  async del(...ks: string[]): Promise<void> {
    void ks;
    throw new NotImplementedError("RedisStore.del — TODO(D)");
  }
}

let instance: Store | null = null;
export function getStore(): Store {
  instance ??= env.store === "redis" ? new RedisStore() : new MemoryStore();
  return instance;
}
