/** 조건 정리기 테스트 — 담당: A */
import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/calc";
import { garam4 } from "@/lib/fixture";
import { isPublishable, resolveEvents } from "@/lib/resolve";
import type { SettlementEvent } from "@/lib/types";

const R = ["가", "나", "다"];
const pay = (id: string, line: string, payer: string, amount: number, item: string, split = R): SettlementEvent => ({
  type: "payment",
  id,
  line,
  payer,
  amount,
  item,
  split,
});

describe("resolveEvents", () => {
  it("기준 예시: 정정·환불을 반영한 항목 3개, 질문 0개", () => {
    const r = resolveEvents(garam4.events, garam4.roster);
    expect(r.items).toEqual(garam4.resolution.items);
    expect(r.questions).toHaveLength(0);
  });

  it("기준 예시: 줄 상태·차단도 기대값과 같고, 계산기에 넣으면 부록 정산표가 나온다", () => {
    const r = resolveEvents(garam4.events, garam4.roster);
    expect(r.lineStatus).toEqual(garam4.resolution.lineStatus);
    expect(r.blockers).toEqual([]);
    const s = calculate(r.items, garam4.roster);
    expect(s.people).toEqual(garam4.settlement.people);
    expect(isPublishable(r, s)).toBe(true);
  });

  it("정정 대상 후보가 둘이면 Q-대상 질문을 만들고 발행을 막는다", () => {
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

  it("Q-대상에 답하면 그 결제에 정정이 들어가고 발행 가능해진다", () => {
    const events = garam4.events.map((e): SettlementEvent =>
      e.type === "correct" ? { ...e, target: ["P1", "P2"] } : e,
    );
    const first = resolveEvents(events, garam4.roster);
    const qid = first.questions[0].id;
    expect(qid).toBe("Q-target-03");
    expect(first.lineStatus["03"]).toBe("needs_check");

    const r = resolveEvents(events, garam4.roster, [{ questionId: qid, value: "P1" }]);
    expect(r.questions).toHaveLength(0);
    expect(r.items[0]).toMatchObject({ id: "P1", grossAmount: 48001, confirmations: [qid] });
    const s = calculate(r.items, garam4.roster);
    expect(s.people).toEqual(garam4.settlement.people);
    expect(isPublishable(r, s)).toBe(true);
  });

  it("후보 배열이라도 실제로 있는 결제가 하나뿐이면 질문 없이 적용한다", () => {
    const r = resolveEvents(
      [pay("P1", "01", "가", 9000, "저녁"), { type: "correct", line: "02", target: ["P1", "P9"], set: { amount: 6000 } }],
      R,
    );
    expect(r.questions).toHaveLength(0);
    expect(r.items[0].grossAmount).toBe(6000);
  });

  it("전액 환불은 순액 0원, 근거 줄이 이어진다", () => {
    const r = resolveEvents(
      [pay("P1", "01", "가", 12000, "택시"), { type: "refund", line: "02", target: "P1", status: "done", full: true }],
      R,
    );
    expect(r.items[0]).toMatchObject({ grossAmount: 12000, amount: 0, evidence: ["01", "02"] });
  });

  it("취소 예정은 Q-환불로 보류한다", () => {
    const events = garam4.events.map((e): SettlementEvent =>
      e.type === "refund" ? { type: "cancel_planned", line: e.line, target: e.target } : e,
    );
    const r = resolveEvents(events, garam4.roster);
    expect(r.questions.map((q) => q.kind)).toContain("refund");
  });

  it("Q-환불: done이면 0원, keep이면 그대로", () => {
    const events: SettlementEvent[] = [pay("P1", "01", "가", 12000, "택시"), { type: "cancel_planned", line: "02", target: "P1" }];
    const done = resolveEvents(events, R, [{ questionId: "Q-refund-02", value: "done" }]);
    expect(done.questions).toHaveLength(0);
    expect(done.items[0].amount).toBe(0);
    const keep = resolveEvents(events, R, [{ questionId: "Q-refund-02", value: "keep" }]);
    expect(keep.questions).toHaveLength(0);
    expect(keep.items[0].amount).toBe(12000);
  });

  it("부분 환불은 범위 밖으로 막는다", () => {
    const r = resolveEvents(
      [pay("P1", "01", "가", 12000, "택시"), { type: "refund", line: "02", target: "P1", status: "done", full: false, amount: 3000 }],
      R,
    );
    expect(r.blockers.map((b) => b.reason)).toContain("partial_refund");
  });

  it("범위 밖(외화)은 blockers에 들어간다", () => {
    const r = resolveEvents([...garam4.events, { type: "out_of_scope", line: "07", reason: "foreign_currency" }], garam4.roster);
    expect(r.blockers.map((b) => b.reason)).toContain("foreign_currency");
  });

  it("제외 금액을 모르면 Q-분리, 답하면 떼어낸 항목을 만들고 합이 원 결제액과 같다", () => {
    const events: SettlementEvent[] = [
      pay("P1", "01", "가", 60000, "저녁"),
      { type: "exclude", line: "02", who: "다", target: "P1", what: "주류", amount: null },
    ];
    const first = resolveEvents(events, R);
    expect(first.questions.map((q) => q.id)).toEqual(["Q-split-02"]);

    const r = resolveEvents(events, R, [{ questionId: "Q-split-02", value: "split", amount: 15000 }]);
    expect(r.questions).toHaveLength(0);
    expect(r.items.map((i) => [i.id, i.amount, i.split])).toEqual([
      ["P1", 45000, ["가", "나", "다"]],
      ["P1-x", 15000, ["가", "나"]],
    ]);
    expect(r.items.reduce((s, i) => s + i.amount, 0)).toBe(60000);
    const s = calculate(r.items, R);
    expect(s.people.map((p) => p.total)).toEqual([22500, 22500, 15000]);
  });

  it("제외 금액이 사건에 있으면 질문 없이 바로 나누고, 같은 품목 제외자는 한 묶음", () => {
    const r = resolveEvents(
      [
        pay("P1", "01", "가", 60000, "저녁"),
        { type: "exclude", line: "02", who: "다", target: "P1", what: "주류", amount: 20000 },
        { type: "exclude", line: "03", who: "나", target: "P1", what: "주류", amount: null },
      ],
      R,
    );
    expect(r.questions).toHaveLength(0);
    expect(r.items.map((i) => [i.id, i.amount, i.split])).toEqual([
      ["P1", 40000, ["가", "나", "다"]],
      ["P1-x", 20000, ["가"]],
    ]);
  });

  it("Q-분리에 ignore로 답하면 나누지 않는다", () => {
    const r = resolveEvents(
      [pay("P1", "01", "가", 60000, "저녁"), { type: "exclude", line: "02", who: "다", target: "P1", what: "주류", amount: null }],
      R,
      [{ questionId: "Q-split-02", value: "ignore" }],
    );
    expect(r.questions).toHaveLength(0);
    expect(r.items).toHaveLength(1);
  });

  it("제외 금액이 결제액보다 크면 막는다", () => {
    const r = resolveEvents(
      [pay("P1", "01", "가", 10000, "저녁"), { type: "exclude", line: "02", who: "다", target: "P1", what: "주류", amount: 20000 }],
      R,
    );
    expect(r.blockers.map((b) => b.reason)).toContain("invalid_item");
  });

  it("같은 결제자·같은 항목·비슷한 금액이 두 번이면 Q-중복", () => {
    const events = [pay("P1", "01", "가", 30000, "2차"), pay("P2", "04", "가", 30000, "2차")];
    const first = resolveEvents(events, R);
    expect(first.questions.map((q) => [q.id, q.kind])).toEqual([["Q-duplicate-04", "duplicate"]]);

    const dup = resolveEvents(events, R, [{ questionId: "Q-duplicate-04", value: "dup" }]);
    expect(dup.questions).toHaveLength(0);
    expect(dup.items.map((i) => i.id)).toEqual(["P1"]);
    expect(dup.lineStatus["04"]).toBe("not_settlement");

    const both = resolveEvents(events, R, [{ questionId: "Q-duplicate-04", value: "both" }]);
    expect(both.items.map((i) => i.id)).toEqual(["P1", "P2"]);
  });

  it("중복으로 지운 결제를 가리키는 정정은 남은 결제에 붙는다", () => {
    const r = resolveEvents(
      [
        pay("P1", "01", "가", 30000, "2차"),
        pay("P2", "02", "가", 30000, "2차"),
        { type: "correct", line: "03", target: "P2", set: { amount: 31000 } },
      ],
      R,
      [{ questionId: "Q-duplicate-02", value: "dup" }],
    );
    expect(r.items.map((i) => [i.id, i.grossAmount])).toEqual([["P1", 31000]]);
  });

  it("직접 입력 항목은 M1부터, status manual", () => {
    const r = resolveEvents([], R, [], [{ name: "주차", payer: "나", amount: 3000, split: ["가", "나"], lines: [] }]);
    expect(r.items).toEqual([
      {
        id: "M1",
        name: "주차",
        payer: "나",
        grossAmount: 3000,
        amount: 3000,
        split: ["가", "나"],
        evidence: [],
        confirmations: ["manual"],
        status: "manual",
      },
    ]);
    expect(r.blockers).toEqual([]);
  });

  it("총무가 줄을 정산 외로 바꾸면 그 줄의 사건은 무시한다", () => {
    const r = resolveEvents(garam4.events, garam4.roster, [], [], { "04": "not_settlement" });
    expect(r.items.map((i) => i.id)).toEqual(["P1", "P2"]);
    expect(r.lineStatus["04"]).toBe("not_settlement");
  });

  it("명단에 없는 분담자·0원 결제는 invalid_item으로 막는다", () => {
    const r = resolveEvents([pay("P1", "01", "가", 1000, "저녁", ["가", "외부인"]), pay("P2", "02", "나", 0, "커피")], R);
    expect(r.blockers.map((b) => [b.line, b.reason])).toEqual(
      expect.arrayContaining([
        ["01", "invalid_item"],
        ["02", "invalid_item"],
      ]),
    );
  });

  it("사건 순서가 섞여 와도 줄 번호 순서로 적용한다", () => {
    const r = resolveEvents([...garam4.events].reverse(), garam4.roster);
    expect(r.items).toEqual(garam4.resolution.items);
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
