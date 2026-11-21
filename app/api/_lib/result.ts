/** 결과 페이지 데이터 만들기 — 담당: D. 별칭·항목·금액·버전만 담는다 (원 발언 금지) */
import { TTL } from "@/lib/store";
import type { EventMeta, ResultView, Version } from "@/lib/types";

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
