/** 조건 정리기 테스트 — 담당: A */
import { describe, expect, it } from "vitest";
import { garam4 } from "@/lib/fixture";
import { isPublishable, resolveEvents } from "@/lib/resolve";
import type { SettlementEvent } from "@/lib/types";

describe("resolveEvents", () => {
  it("기준 예시: 정정·환불을 반영한 항목 3개, 질문 0개", () => {
    const r = resolveEvents(garam4.events, garam4.roster);
    expect(r.items).toEqual(garam4.resolution.items);
    expect(r.questions).toHaveLength(0);
  });

  it.skip("정정 대상 후보가 둘이면 Q-대상 질문을 만들고 발행을 막는다", () => {
    const events = garam4.events.map((e): SettlementEvent =>
      e.type === "correct" ? { ...e, target: ["P1", "P2"] } : e,
    );
    const r = resolveEvents(events, garam4.roster);
    const q = garam4.variants.ambiguousTarget.expectQuestion;
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].kind).toBe(q.kind);
    expect(r.questions[0].options.map((o) => o.value)).toEqual(q.optionValues);
    expect(isPublishable(r, garam4.settlement)).toBe(false);
  });

  it.skip("취소 예정은 Q-환불로 보류한다", () => {
    const events = garam4.events.map((e): SettlementEvent =>
      e.type === "refund" ? { type: "cancel_planned", line: e.line, target: e.target } : e,
    );
    const r = resolveEvents(events, garam4.roster);
    expect(r.questions.map((q) => q.kind)).toContain("refund");
  });

  it.skip("범위 밖(외화)은 blockers에 들어간다", () => {
    const r = resolveEvents([...garam4.events, { type: "out_of_scope", line: "07", reason: "foreign_currency" }], garam4.roster);
    expect(r.blockers.map((b) => b.reason)).toContain("foreign_currency");
  });
});

describe("isPublishable", () => {
  it("기준 예시는 발행 가능", () => {
    expect(isPublishable(garam4.resolution, garam4.settlement)).toBe(true);
  });
  it("미해결 질문이 있으면 불가", () => {
    const r = { ...garam4.resolution, questions: [{ id: "q", kind: "target" as const, line: "03", prompt: "", options: [] }] };
    expect(isPublishable(r, garam4.settlement)).toBe(false);
  });
});
