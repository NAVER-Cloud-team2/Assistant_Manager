/** 결과 페이지 데이터 만들기 — 담당: D. 별칭·항목·금액·버전만 담는다 (원 발언 금지) */
import { getStore, keys, TTL } from "@/lib/store";
import { hashToken } from "@/lib/token";
import type { EventMeta, ResultView, Version } from "@/lib/types";

export type ResultLookup =
  | { status: "ok"; view: ResultView }
  /** 토큰이 없거나, 지워졌거나, 30일이 지남 */
  | { status: "not_found" }
  /** 행사는 있지만 아직 발행 전 */
  | { status: "unpublished" };

/**
 * 결과 토큰으로 최신 판을 찾는다. GET /api/r/{token}과 S6 페이지(/r/{token})가 같이 쓴다.
 * 토큰은 해시로만 조회하고 로그에 남기지 않는다.
 */
export async function loadResult(token: string): Promise<ResultLookup> {
  const store = getStore();
  const id = await store.get<string>(keys.resultToken(hashToken(token)));
  if (!id) return { status: "not_found" };
  const [meta, latest] = await Promise.all([
    store.get<EventMeta>(keys.event(id)),
    store.get<number>(keys.latestVersion(id)),
  ]);
  if (!meta || !latest) return { status: "unpublished" };
  const version = await store.get<Version>(keys.version(id, latest));
  if (!version) return { status: "not_found" };
  return { status: "ok", view: toResultView(meta, version) };
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export function toResultView(meta: EventMeta, v: Version): ResultView {
  const people = v.settlement.people.map((p) => ({
    alias: p.alias,
    total: p.total,
    balance: p.balance,
    lines: v.items.map((item) => {
      const amount = p.shares[item.id] ?? 0;
      let reason: string;
      if (!item.split.includes(p.alias)) reason = "참여 안 함";
      else if (item.amount === 0) reason = "전액 환불";
      else {
        reason = `${won(item.amount)}을 ${item.split.length}명이 나눔`;
        if (p.remainderFrom.includes(item.id)) reason += ", 나머지 1원 포함";
      }
      return { item: item.name, amount, reason };
    }),
  }));
  return {
    eventName: meta.name,
    version: v.n,
    replaces: v.n > 1 ? v.n - 1 : null,
    people,
    transfers: v.transfers,
    diff: v.diff ?? null,
    expiresAt: new Date(Date.parse(v.publishedAt) + TTL.result * 1000).toISOString(),
  };
}
