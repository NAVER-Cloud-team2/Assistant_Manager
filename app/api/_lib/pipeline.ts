/**
 * 초안 만들기 흐름 — 담당: D (각 단계 함수는 A·B 담당)
 * 가린 줄 → parse(B) → extract(B, 10초 제한) → resolve(A) → calculate(A)
 */
import { open, seal, type Sealed } from "@/lib/crypto";
import { calculate } from "@/lib/calc";
import { extractEvents } from "@/lib/extract";
import { log } from "@/lib/log";
import { parseLines } from "@/lib/parse";
import { isPublishable, resolveEvents } from "@/lib/resolve";
import { getStore, keys, TTL } from "@/lib/store";
import type { Answer, Draft, EventMeta, ManualItem, MaskedLine, SettlementEvent } from "@/lib/types";

export const AI_TIMEOUT_MS = 10_000;

export interface StoredExtract {
  events: SettlementEvent[];
  model: string;
  promptVersion: string;
  ai: boolean;
  failed: boolean;
}

export interface StoredConfirm {
  answers: Answer[];
  manualItems: ManualItem[];
  lineOverrides: Record<string, "candidate" | "not_settlement">;
}

const EMPTY_CONFIRM: StoredConfirm = { answers: [], manualItems: [], lineOverrides: {} };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** 새 발췌문: 저장하고 AI까지 돌린다 */
export async function ingestExcerpt(meta: EventMeta, lines: MaskedLine[]): Promise<Draft> {
  const store = getStore();
  const parsed = parseLines(lines);
  let extract: StoredExtract;
  try {
    const r = await withTimeout(extractEvents(lines, meta.roster, parsed), AI_TIMEOUT_MS);
    extract = { ...r, failed: false };
  } catch (e) {
    // 본문 없이 실패 사유만 남긴다. 화면은 직접 입력으로 넘어간다.
    log.warn("extract_failed", { eventId: meta.id, reason: e instanceof Error ? e.name : "unknown" });
    extract = { events: [], model: "none", promptVersion: "none", ai: false, failed: true };
  }
  await Promise.all([
    store.set(keys.excerpt(meta.id), seal(lines), TTL.source),
    store.set(keys.extract(meta.id), seal(extract), TTL.source),
    store.set(keys.confirm(meta.id), seal(EMPTY_CONFIRM), TTL.source),
  ]);
  return compose(meta, lines, extract, EMPTY_CONFIRM);
}

/** 저장된 발췌문·사건·확인값으로 초안을 다시 만든다 (AI를 다시 부르지 않는다) */
export async function loadDraft(meta: EventMeta, confirm?: StoredConfirm): Promise<Draft | null> {
  const store = getStore();
  const [lines, extract, saved] = await Promise.all([
    store.get<Sealed>(keys.excerpt(meta.id)),
    store.get<Sealed>(keys.extract(meta.id)),
    store.get<Sealed>(keys.confirm(meta.id)),
  ]);
  if (!lines || !extract) return null;
  const c = confirm ?? (saved ? open<StoredConfirm>(saved) : EMPTY_CONFIRM);
  if (confirm) {
    // 수정할 때마다 7일 TTL을 다시 건다
    await Promise.all([
      store.set(keys.confirm(meta.id), seal(confirm), TTL.source),
      store.set(keys.excerpt(meta.id), lines, TTL.source),
      store.set(keys.extract(meta.id), extract, TTL.source),
    ]);
  }
  return compose(meta, open<MaskedLine[]>(lines), open<StoredExtract>(extract), c);
}

function compose(meta: EventMeta, lines: MaskedLine[], extract: StoredExtract, c: StoredConfirm): Draft {
  const resolution = resolveEvents(extract.events, meta.roster, c.answers, c.manualItems, c.lineOverrides);
  const settlement = resolution.items.length > 0 ? calculate(resolution.items, meta.roster) : null;
  return {
    lines,
    resolution,
    settlement,
    aiDraft: extract.ai,
    aiFailed: extract.failed,
    publishable: isPublishable(resolution, settlement),
  };
}
