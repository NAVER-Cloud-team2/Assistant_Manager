/**
 * 조건 정리기 — 담당: A (구현계획서 4-3, 핵심)
 *
 * 사건을 줄 번호 순서로 적용해 항목·질문·차단 사유를 만든다.
 * - 결제: 항목 생성 (결제자 1명, 금액 > 0, 분담자 1명 이상)
 * - 정정: 대상이 하나면 적용하고 근거를 잇는다. 후보가 둘 이상이면 Q-대상 질문
 * - 제외: 분리 금액이 없으면 Q-분리 질문. 분리 후 합 = 원 결제액
 * - 환불: done + full → 순액 0. cancel_planned → Q-환불로 보류. 부분 환불은 범위 밖
 * - 중복 의심 → Q-중복
 * - 범위 밖 → blockers (전체 송금안 발행 차단)
 * - 정산 외 → 항목 없음
 * 총무의 답(answers)과 직접 입력(manualItems)은 AI 사건보다 우선한다. 근거에 confirmations로 남긴다.
 *
 * 규칙: AI를 부르지 않는다. 금액 계산은 calc.ts에 맡긴다.
 *
 * ── 질문과 답의 약속 (C 화면·D API가 쓰는 모양) ─────────────────────────────
 * 질문 id는 `Q-{kind}-{줄번호}` 로 고정이다. 같은 입력이면 다시 돌려도 같은 id가 나오므로
 * 답(Answer.questionId)을 저장해 두었다가 그대로 다시 넘기면 된다.
 *
 * | kind      | 언제                              | Answer.value               | Answer.amount     |
 * | --------- | --------------------------------- | -------------------------- | ----------------- |
 * | target    | 정정·제외·환불 대상 후보가 둘 이상 | 고른 결제 id (options 중)   | —                 |
 * | split     | 제외할 금액을 모름                 | "split" 또는 "ignore"      | split이면 제외 금액 |
 * | refund    | 취소 예정                          | "done"(환불됨) 또는 "keep"  | —                 |
 * | duplicate | 같은 결제가 두 번 올라온 듯         | "both"(둘 다 진짜) 또는 "dup"(뒤의 것 삭제) | — |
 *
 * 제외(split) 결과: 원 항목에서 제외 금액만큼 떼어 `{id}-x` 항목(분담자에서 제외자 뺌)을 만든다.
 * 직접 입력 항목 id는 M1, M2 … (입력 순서), status "manual", confirmations ["manual"].
 * lineOverrides의 "not_settlement"는 그 줄의 사건을 모두 무시한다.
 */
import type {
  Alias,
  Answer,
  Blocker,
  Item,
  LineNo,
  LineStatus,
  ManualItem,
  Question,
  Resolution,
  Settlement,
  SettlementEvent,
  Target,
} from "./types";

type Override = "candidate" | "not_settlement";

interface Exclusion {
  who: Alias[];
  what: string;
  amount: number;
  lines: LineNo[];
}

interface Work {
  item: Item;
  refunded: boolean;
  /** what(제외 품목) → 제외 묶음 */
  exclusions: Map<string, Exclusion>;
  /** 중복으로 지워졌으면 남은 항목 id */
  mergedInto?: string;
}

export function resolveEvents(
  events: SettlementEvent[],
  roster: Alias[],
  answers: Answer[] = [],
  manualItems: ManualItem[] = [],
  lineOverrides: Record<string, Override> = {},
): Resolution {
  const answerOf = new Map(answers.map((a) => [a.questionId, a]));
  const works = new Map<string, Work>();
  const questions: Question[] = [];
  const blockers: Blocker[] = [];
  const lineStatus: Record<LineNo, LineStatus> = {};

  const mark = (line: LineNo, s: LineStatus) => {
    const rank: Record<LineStatus, number> = { not_settlement: 0, candidate: 1, needs_check: 2 };
    if (lineStatus[line] === undefined || rank[s] > rank[lineStatus[line]]) lineStatus[line] = s;
  };
  const ask = (q: Question) => {
    questions.push(q);
    mark(q.line, "needs_check");
  };
  const live = (id: string): Work | undefined => {
    let w = works.get(id);
    while (w?.mergedInto) w = works.get(w.mergedInto);
    return w;
  };

  /** 대상 후보를 하나로 좁힌다. 둘 이상이면 Q-대상 질문을 내고 undefined */
  const pickTarget = (target: Target, line: LineNo, what: string): Work | undefined => {
    const ids = [...new Set((Array.isArray(target) ? target : [target]).map((id) => live(id)?.item.id))].filter(
      (id): id is string => id !== undefined,
    );
    if (ids.length === 0) {
      mark(line, "needs_check"); // 없는 결제를 가리킴 → 총무가 직접 확인
      return undefined;
    }
    if (ids.length === 1) return works.get(ids[0]);
    const qid = `Q-target-${line}`;
    const a = answerOf.get(qid);
    if (a && ids.includes(a.value)) {
      const w = works.get(a.value)!;
      w.item.confirmations.push(qid);
      return w;
    }
    ask({
      id: qid,
      kind: "target",
      line,
      prompt: `${line}줄 ${what}은(는) 어느 결제에 적용할까요?`,
      options: ids.map((id) => ({ value: id, label: label(works.get(id)!.item) })),
    });
    return undefined;
  };

  const sorted = events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => lineNum(a.e.line) - lineNum(b.e.line) || a.i - b.i)
    .map((x) => x.e);

  for (const e of sorted) {
    if (lineOverrides[e.line] === "not_settlement") continue;

    switch (e.type) {
      case "payment": {
        const item: Item = {
          id: e.id,
          name: e.item,
          payer: e.payer,
          grossAmount: e.amount,
          amount: e.amount,
          split: [...new Set(e.split)],
          evidence: [e.line],
          confirmations: [],
          status: "candidate",
        };
        works.set(e.id, { item, refunded: false, exclusions: new Map() });
        mark(e.line, "candidate");

        const twin = [...works.values()].find(
          (w) => !w.mergedInto && w.item.id !== e.id && looksDuplicate(w.item, item),
        );
        if (twin) {
          const qid = `Q-duplicate-${e.line}`;
          const a = answerOf.get(qid);
          if (a?.value === "dup") {
            works.get(e.id)!.mergedInto = twin.item.id;
            twin.item.confirmations.push(qid);
            lineStatus[e.line] = "not_settlement";
          } else if (a?.value === "both") {
            item.confirmations.push(qid);
          } else {
            ask({
              id: qid,
              kind: "duplicate",
              line: e.line,
              prompt: `${e.line}줄 결제가 ${twin.item.evidence[0]}줄과 같은 결제 같아요. 두 번 올라온 건가요?`,
              options: [
                { value: "both", label: "아니요, 둘 다 따로 결제했어요" },
                { value: "dup", label: "네, 같은 결제예요 (뒤의 것 지우기)" },
              ],
            });
          }
        }
        break;
      }

      case "correct": {
        const w = pickTarget(e.target, e.line, "정정");
        if (!w) break;
        const { amount, split, item, payer } = e.set;
        if (amount !== undefined) w.item.grossAmount = amount;
        if (split !== undefined) w.item.split = [...new Set(split)];
        if (item !== undefined) w.item.name = item;
        if (payer !== undefined) w.item.payer = payer;
        w.item.evidence.push(e.line);
        mark(e.line, "candidate");
        break;
      }

      case "exclude": {
        const w = pickTarget(e.target, e.line, "제외");
        if (!w) break;
        if (!w.item.split.includes(e.who)) {
          mark(e.line, "needs_check"); // 원래 분담자가 아닌 사람을 빼라고 함
          break;
        }
        w.item.evidence.push(e.line);
        const group = w.exclusions.get(e.what);
        if (group) {
          // 같은 품목(예: 주류)을 또 다른 사람이 안 먹음 → 같은 묶음에 사람만 추가
          if (!group.who.includes(e.who)) group.who.push(e.who);
          group.lines.push(e.line);
          if (group.amount <= 0 && e.amount !== null && e.amount > 0) group.amount = e.amount;
          mark(e.line, "candidate");
          break;
        }
        let amount = e.amount ?? 0;
        if (!(amount > 0)) {
          const qid = `Q-split-${e.line}`;
          const a = answerOf.get(qid);
          if (a?.value === "ignore") {
            w.item.confirmations.push(qid);
            mark(e.line, "candidate");
            break;
          }
          if (a?.value === "split" && a.amount !== undefined && Number.isSafeInteger(a.amount) && a.amount > 0) {
            amount = a.amount;
            w.item.confirmations.push(qid);
          } else {
            ask({
              id: qid,
              kind: "split",
              line: e.line,
              prompt: `${e.who}이(가) ${w.item.name}에서 빠질 ${e.what} 금액은 얼마인가요?`,
              options: [
                { value: "split", label: "금액을 입력해 따로 나누기" },
                { value: "ignore", label: "빼지 않고 그대로 나누기" },
              ],
            });
            break;
          }
        }
        w.exclusions.set(e.what, { who: [e.who], what: e.what, amount, lines: [e.line] });
        mark(e.line, "candidate");
        break;
      }

      case "refund": {
        const w = pickTarget(e.target, e.line, "환불");
        if (!w) break;
        w.item.evidence.push(e.line);
        if (e.full) {
          w.refunded = true;
          mark(e.line, "candidate");
        } else {
          blockers.push({ line: e.line, reason: "partial_refund" }); // 부분 환불은 범위 밖
          mark(e.line, "needs_check");
        }
        break;
      }

      case "cancel_planned": {
        const w = pickTarget(e.target, e.line, "취소");
        if (!w) break;
        w.item.evidence.push(e.line);
        const qid = `Q-refund-${e.line}`;
        const a = answerOf.get(qid);
        if (a?.value === "done") {
          w.refunded = true;
          w.item.confirmations.push(qid);
          mark(e.line, "candidate");
        } else if (a?.value === "keep") {
          w.item.confirmations.push(qid);
          mark(e.line, "candidate");
        } else {
          w.item.status = "needs_check";
          ask({
            id: qid,
            kind: "refund",
            line: e.line,
            prompt: `${w.item.name} 결제가 취소 예정이에요. 환불이 끝났나요?`,
            options: [
              { value: "done", label: "환불됐어요 (0원으로)" },
              { value: "keep", label: "취소 안 해요 (그대로 정산)" },
            ],
          });
        }
        break;
      }

      case "out_of_scope":
        blockers.push({ line: e.line, reason: e.reason });
        mark(e.line, "needs_check");
        break;

      case "not_settlement":
        mark(e.line, "not_settlement");
        break;
    }
  }

  // 항목 확정: 환불 → 순액, 제외 → 떼어낸 항목
  const items: Item[] = [];
  for (const w of works.values()) {
    if (w.mergedInto) continue;
    const it = w.item;
    if (!(Number.isSafeInteger(it.grossAmount) && it.grossAmount > 0)) {
      blockers.push({ line: it.evidence[0], reason: "invalid_item" }); // 결제 금액은 0보다 커야 한다
    }
    it.amount = w.refunded ? 0 : it.grossAmount;
    const subs: Item[] = [];
    const excludedTotal = [...w.exclusions.values()].reduce((s, x) => s + x.amount, 0);
    if (it.amount > 0 && excludedTotal > it.amount) {
      blockers.push({ line: it.evidence[0], reason: "invalid_item" }); // 제외 금액이 결제액보다 큼
    } else if (it.amount > 0) {
      let n = 0;
      for (const x of w.exclusions.values()) {
        const rest = it.split.filter((a) => !x.who.includes(a));
        n++;
        subs.push({
          id: n === 1 ? `${it.id}-x` : `${it.id}-x${n}`,
          name: `${it.name} (${x.what})`,
          payer: it.payer,
          grossAmount: x.amount,
          amount: x.amount,
          split: rest,
          evidence: [it.evidence[0], ...x.lines],
          confirmations: [...it.confirmations],
          status: it.status,
        });
      }
      const excluded = subs.reduce((s, x) => s + x.amount, 0);
      it.grossAmount -= excluded;
      it.amount -= excluded;
    }
    items.push(it, ...subs);
  }

  manualItems.forEach((m, i) => {
    items.push({
      id: `M${i + 1}`,
      name: m.name,
      payer: m.payer,
      grossAmount: m.amount,
      amount: m.amount,
      split: [...new Set(m.split)],
      evidence: [...m.lines],
      confirmations: ["manual"],
      status: "manual",
    });
    for (const l of m.lines) mark(l, "candidate");
    if (!(Number.isSafeInteger(m.amount) && m.amount > 0)) {
      blockers.push({ line: m.lines[0] ?? "", reason: "invalid_item" }); // 직접 입력도 금액 > 0
    }
  });

  // 결제 조건 검사: 결제자·분담자가 명단에 있고, 분담자 1명 이상, 금액은 0 이상의 정수
  const known = new Set(roster);
  for (const it of items) {
    const ok =
      known.has(it.payer) &&
      it.split.length > 0 &&
      it.split.every((a) => known.has(a)) &&
      Number.isSafeInteger(it.amount) &&
      it.amount >= 0;
    if (!ok) blockers.push({ line: it.evidence[0] ?? "", reason: "invalid_item" });
  }

  for (const [line, o] of Object.entries(lineOverrides)) lineStatus[line] = o;

  return { items, questions, blockers, lineStatus };
}

/** 발행 가능 조건: 미해결 질문 0, 차단 0, 검산 모두 통과 */
export function isPublishable(resolution: Resolution, settlement: Settlement | null): boolean {
  return (
    settlement !== null &&
    resolution.items.length > 0 &&
    resolution.questions.length === 0 &&
    resolution.blockers.length === 0 &&
    settlement.checks.every((c) => c.ok)
  );
}

/** 같은 결제자·같은 항목 이름·금액 차이 5% 이내 */
function looksDuplicate(a: Item, b: Item): boolean {
  if (a.payer !== b.payer || norm(a.name) !== norm(b.name)) return false;
  const diff = Math.abs(a.grossAmount - b.grossAmount);
  return diff * 20 <= Math.max(a.grossAmount, b.grossAmount);
}

function norm(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

function lineNum(l: LineNo): number {
  const n = Number.parseInt(l, 10);
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
}

function label(it: Item): string {
  return `${it.name} ${won(it.grossAmount)} (${it.payer} 결제)`;
}

function won(n: number): string {
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}원`;
}
