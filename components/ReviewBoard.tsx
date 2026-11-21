"use client";

/**
 * S3 검토 — 담당: C (구현계획서 3장 S3, 4-3)
 * 줄 번호 붙은 발언을 ‘확정 후보 / 확인 필요 / 정산 외’로 표시, 질문 카드, 직접 항목 추가, 줄 분류 바꾸기.
 * 총무의 답·직접 입력은 확인값으로 저장되고 AI 사건보다 우선한다. 저장할 때마다 서버가 다시 정리·계산한다.
 *
 * 표시: 연필(점선) = AI가 뽑은 값, 형광펜 = 확인 필요, 파랑 펜 = 총무가 확인한 값. 여백의 번호는 대화의 줄 번호다.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ADMIN_HEADER, type AnswersRequest, type ApiError } from "@/lib/api";
import { parseLines } from "@/lib/parse";
import type { Alias, Answer, Blocker, Draft, Item, LineStatus, ManualItem, MaskedLine, Question } from "@/lib/types";
import { scrollBehavior, won } from "./format";
import { IconCheck } from "./icons";
import s from "./ReviewBoard.module.css";

type Overrides = Record<string, "candidate" | "not_settlement">;
export interface Confirm {
  answers: Answer[];
  manualItems: ManualItem[];
  lineOverrides: Overrides;
}

const STATUS: Record<LineStatus, { label: string; cls: string }> = {
  candidate: { label: "확정 후보", cls: s.candidate },
  needs_check: { label: "확인 필요", cls: s.needsCheck },
  not_settlement: { label: "정산 외", cls: s.notSettlement },
};

const BLOCKER_LABEL: Record<Blocker["reason"], string> = {
  foreign_currency: "외화 결제",
  prepaid: "선입금",
  partial_refund: "부분 환불",
  joint_payment: "공동 결제",
  other: "자동 계산 범위 밖",
  unresolved_question: "답하지 않은 질문",
  invalid_item: "항목 정보 부족",
};

const KIND_LABEL: Record<Question["kind"], string> = {
  target: "어느 결제?",
  split: "금액 나누기",
  refund: "환불",
  duplicate: "중복 의심",
};

/** 질문 답 값 → 화면 표시 (A의 resolve.ts 맨 위 표) */
const ANSWER_LABEL: Record<string, string> = {
  split: "금액을 따로 나눔",
  ignore: "빼지 않고 그대로 나눔",
  done: "환불됨 (0원으로)",
  keep: "취소 안 함 (그대로 정산)",
  dup: "같은 결제 (뒤의 것 지움)",
  both: "둘 다 따로 결제",
};

/** 수동 정산(자동 계산 범위 밖) 사유인지. 그 밖은 항목 정보 부족·미해결 질문 */
const isOutOfScope = (r: Blocker["reason"]) => r !== "invalid_item" && r !== "unresolved_question";

/** 질문 id(Q-{kind}-{줄})에서 줄 번호. 형식이 다르면 null */
const lineOfQuestion = (questionId: string) => /^Q-[a-z]+-(.+)$/.exec(questionId)?.[1] ?? null;

/**
 * 질문 문장의 조사 고르기. A의 resolve.ts는 이름 뒤에 "이(가)"처럼 두 조사를 함께 적어 보낸다.
 * 화면에 보일 때만 앞 글자의 받침에 맞는 하나로 바꾼다 (지호이(가) → 지호가, 라온이(가) → 라온이).
 * 앞 글자가 한글이 아니면 그대로 둔다.
 */
export function fixJosa(text: string): string {
  const pairs: [string, string, string][] = [
    ["이(가)", "이", "가"],
    ["은(는)", "은", "는"],
    ["을(를)", "을", "를"],
    ["과(와)", "과", "와"],
    ["와(과)", "과", "와"],
  ];
  let out = text;
  for (const [mark, withBatchim, without] of pairs) {
    out = out.split(mark).reduce((acc, part, i) => {
      if (i === 0) return part;
      const prev = acc.slice(-1);
      const code = prev.charCodeAt(0) - 0xac00;
      if (code < 0 || code > 11171) return acc + mark + part;
      return acc + (code % 28 === 0 ? without : withBatchim) + part;
    });
  }
  return out;
}

/** "48,001" "48001원" → 48001. 정수가 아니면 null */
export function parseWon(input: string): number | null {
  const t = input.replace(/[,\s원]/g, "");
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

export function ReviewBoard({
  token,
  eventId,
  roster,
  initialDraft,
  initialConfirm,
}: {
  token: string;
  eventId: string;
  roster: Alias[];
  initialDraft: Draft;
  initialConfirm: Confirm;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [confirm, setConfirm] = useState(initialConfirm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { resolution } = draft;
  const itemsByLine = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of resolution.items) for (const no of it.evidence) m.set(no, [...(m.get(no) ?? []), it]);
    return m;
  }, [resolution.items]);
  /** 규칙 파서(B의 lib/parse.ts)가 읽은 줄별 금액 — AI가 놓친 금액 줄을 찾는 데 쓴다 */
  const amountsByLine = useMemo(() => new Map(parseLines(draft.lines).map((p) => [p.no, p.amounts])), [draft.lines]);
  /** 금액이 있는데 아무 항목에도 반영되지 않은 줄 (AI가 사건을 놓쳤거나 정산 외로 본 줄). 총무가 직접 '정산 외로' 바꾼 줄은 뺀다 */
  const missedLines = useMemo(
    () =>
      draft.lines
        .filter((l) => {
          const st = resolution.lineStatus[l.no] ?? "not_settlement";
          return st === "not_settlement" && !confirm.lineOverrides[l.no] && (amountsByLine.get(l.no)?.length ?? 0) > 0;
        })
        .map((l) => l.no),
    [draft.lines, resolution.lineStatus, confirm.lineOverrides, amountsByLine],
  );
  const blockersByLine = useMemo(() => {
    const m = new Map<string, Blocker[]>();
    for (const b of resolution.blockers) m.set(b.line, [...(m.get(b.line) ?? []), b]);
    return m;
  }, [resolution.blockers]);
  const questionsByLine = useMemo(() => {
    const m = new Map<string, Question[]>();
    for (const q of resolution.questions) m.set(q.line, [...(m.get(q.line) ?? []), q]);
    return m;
  }, [resolution.questions]);

  /** 확인값 전체를 저장 → 서버가 다시 정리·계산한 초안으로 화면을 바꾼다 */
  async function save(next: Confirm) {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      const body: AnswersRequest = { answers: next.answers, manualItems: next.manualItems, lineOverrides: next.lineOverrides };
      const res = await fetch(`/api/events/${eventId}/answers`, {
        method: "POST",
        headers: { "content-type": "application/json", [ADMIN_HEADER]: token },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as Draft | ApiError | null;
      if (!res.ok || !data || "error" in data) {
        setError(data && "error" in data ? data.error : "저장하지 못했어요. 잠시 뒤 다시 해 주세요.");
        return false;
      }
      setDraft(data);
      setConfirm(next);
      router.refresh(); // 위쪽 단계 메뉴의 남은 개수·체크를 새 초안에 맞춘다
      return true;
    } catch {
      setError("인터넷 연결을 확인하고 다시 해 주세요.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const answer = (a: Answer) =>
    save({ ...confirm, answers: [...confirm.answers.filter((x) => x.questionId !== a.questionId), a] });
  const undoAnswer = (questionId: string) =>
    save({ ...confirm, answers: confirm.answers.filter((x) => x.questionId !== questionId) });
  /**
   * 직접 입력 저장. 항목 고치기면 AI가 만든 원래 항목의 근거 줄을 ‘정산 외’로 돌리고(그 줄의 AI 사건은 무시)
   * 고친 항목을 직접 입력으로 대신 넣는다. 직접 입력 항목을 고치면 그 항목만 바꾼다. (A의 resolve.ts 규칙)
   */
  const submitManual = (items: ManualItem[], fix: FixTarget | null) => {
    const manualItems = [...confirm.manualItems];
    if (fix?.manualIndex !== undefined) manualItems.splice(fix.manualIndex, 1);
    manualItems.push(...items);
    const lineOverrides: Overrides = { ...confirm.lineOverrides };
    if (fix && fix.manualIndex === undefined) for (const no of fix.lines) lineOverrides[no] = "not_settlement";
    return save({ ...confirm, manualItems, lineOverrides });
  };
  const removeManual = (i: number) => save({ ...confirm, manualItems: confirm.manualItems.filter((_, j) => j !== i) });
  /** 이 줄을 근거로 한 직접 입력 항목 (항목 고치기로 만든 대체 항목) */
  const manualOnLine = (no: string) => confirm.manualItems.filter((m) => m.lines.includes(no));
  /**
   * 고친 줄 되돌리기: 그 줄을 근거로 한 직접 입력 항목과, 그 항목들이 정산 외로 돌린 줄을 함께 되돌린다.
   * (AI 항목만 되살아나고 고친 항목이 남아 두 번 계산되는 일을 막는다)
   */
  const revertFix = (no: string) => {
    const replaced = manualOnLine(no);
    const lines = new Set([no, ...replaced.flatMap((m) => m.lines)]);
    const lineOverrides: Overrides = { ...confirm.lineOverrides };
    for (const l of lines) delete lineOverrides[l];
    return save({ ...confirm, manualItems: confirm.manualItems.filter((m) => !replaced.includes(m)), lineOverrides });
  };
  const setOverride = (no: string, v: "candidate" | "not_settlement" | null) => {
    const next: Overrides = { ...confirm.lineOverrides };
    if (v) next[no] = v;
    else delete next[no];
    return save({ ...confirm, lineOverrides: next });
  };

  /** 답 값을 읽기 쉬운 말로: 항목 id면 항목 이름(P1 → 저녁), 아니면 답 값 이름 */
  const answerLabel = (v: string) => {
    const it = resolution.items.find((x) => x.id === v);
    return it ? it.name : (ANSWER_LABEL[v] ?? v);
  };

  /** 정산 외 줄을 근거로 직접 입력 폼 열기 (말한 사람이 명단에 있으면 결제한 사람으로, 읽힌 금액이 있으면 금액으로 미리 채움) */
  const [prefill, setPrefill] = useState<FormPrefill | null>(null);
  const addFromLine = (no: string, speaker: string | null) =>
    setPrefill((p) => ({
      n: (p?.n ?? 0) + 1,
      line: no,
      payer: speaker && roster.includes(speaker) ? speaker : "",
      amount: amountsByLine.get(no)?.[0],
      partLine: missedLines.find((x) => x !== no) ?? "",
      fix: null,
    }));
  /** 항목 고치기: AI(또는 직접 입력)가 만든 항목의 값으로 폼을 채워 연다 */
  const fixItem = (it: Item) => {
    const manualIndex = it.status === "manual" ? Number(it.id.slice(1)) - 1 : undefined;
    const lines = [...new Set(it.evidence)];
    // 같은 줄에서 나온 다른 항목은 그 줄을 정산 외로 돌리면 함께 사라진다 → 폼에서 미리 알린다
    const alsoRemoved =
      manualIndex !== undefined
        ? []
        : [...new Set(resolution.items.filter((x) => x.id !== it.id && x.status !== "manual" && x.evidence.some((no) => lines.includes(no))).map((x) => x.name))];
    setPrefill((p) => ({
      n: (p?.n ?? 0) + 1,
      line: lines[0] ?? "",
      payer: it.payer,
      amount: it.amount,
      partLine: missedLines[0] ?? "",
      fix: { itemName: it.name, name: it.name, split: it.split, lines, alsoRemoved, manualIndex },
    }));
  };

  /** 선택지가 결제 id(P1 등)면 그 결제의 근거 줄을 나란히 보여 준다 (발표 10쪽: 후보 결제와 근거를 나란히) */
  const optionEvidence = (q: Question): Record<string, QuoteLine[]> => {
    const out: Record<string, QuoteLine[]> = {};
    for (const o of q.options) {
      const it = resolution.items.find((x) => x.id === o.value);
      if (!it) continue;
      out[o.value] = it.evidence
        .map((no) => draft.lines.find((l) => l.no === no))
        .filter((l): l is MaskedLine => !!l)
        .map((l) => ({ no: l.no, who: l.speaker ?? "말한 사람 없음", text: l.text }));
    }
    return out;
  };

  const unresolved = resolution.questions.length;
  const outOfScope = resolution.blockers.filter((b) => isOutOfScope(b.reason)).length;
  const invalid = resolution.blockers.filter((b) => b.reason === "invalid_item").length;

  return (
    <>
      {/* 상태 요약 */}
      <div className="blk status">
        {draft.aiFailed ? (
          <>
            <p>
              <b>AI 분석에 실패했어요.</b>
            </p>
            <p className="note">아래 ‘직접 항목 추가’로 결제를 넣어 주세요. 붙여넣은 대화는 근거로 고를 수 있어요.</p>
          </>
        ) : (
          draft.aiDraft && (
            <p className="note">
              <span className="pencil">AI 추출 초안</span> · 연필 글씨는 AI가 뽑은 값이에요. 확인한 뒤 발행해요.
            </p>
          )
        )}
        {missedLines.length > 0 && (
          <div className="caution">
            <p>
              <b>금액이 있는데 반영되지 않은 줄이 있어요.</b>
            </p>
            <p>
              {missedLines.join(", ")}줄 · AI가 놓쳤을 수 있어요. 그 줄의 ‘항목 추가’나 관련 항목의 ‘고치기’로 반영하고, 정산과 무관한
              줄이면 ‘정산과 무관해요’를 눌러 주세요.
            </p>
          </div>
        )}
        <div className={s.verdict} aria-live="polite">
          {draft.publishable ? (
            <>
              <p className="pen">
                <IconCheck />
                발행할 수 있어요
              </p>
              <p className={s.next}>
                <Link className="btn" href={`/m/${token}/publish`}>
                  발행하러 가기
                </Link>
                <Link className="textbtn" href={`/m/${token}/table`}>
                  정산표 확인
                </Link>
              </p>
            </>
          ) : (
            <>
              <p>
                <b>아직 발행할 수 없어요.</b>
              </p>
              <ul className="todo">
                {unresolved > 0 && (
                  <li>
                    <span className="mark">답할 질문 {unresolved}개</span>
                  </li>
                )}
                {outOfScope > 0 && (
                  <li>
                    <span className="mark">수동 정산이 필요한 줄 {outOfScope}개</span> (외화·선입금 등)
                  </li>
                )}
                {invalid > 0 && (
                  <li>
                    <span className="mark">정보가 부족한 항목 {invalid}개</span> (금액·결제한 사람·나눌 사람 확인)
                  </li>
                )}
                {resolution.items.length === 0 && <li>정산할 항목이 없어요</li>}
                {unresolved === 0 && outOfScope === 0 && invalid === 0 && resolution.items.length > 0 && (
                  <li>검산을 확인해 주세요 (정산표)</li>
                )}
              </ul>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="blk tip">
          <p className="alert" role="alert">
            {error}
          </p>
        </div>
      )}

      {/* 질문 */}
      {resolution.questions.length > 0 && (
        <section aria-labelledby="review-questions">
          <h2 className="blk sub" id="review-questions">
            확인이 필요한 것<span className="unit">{resolution.questions.length}개</span>
          </h2>
          {resolution.questions.map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              line={draft.lines.find((l) => l.no === q.line)}
              optionEvidence={optionEvidence(q)}
              lineAmounts={amountsByLine.get(q.line) ?? []}
              busy={busy}
              onAnswer={answer}
            />
          ))}
        </section>
      )}

      {/* 발언 목록 */}
      <section aria-labelledby="review-lines">
        <h2 className="blk sub" id="review-lines">
          붙여넣은 대화
        </h2>
        <ol>
          {draft.lines.map((l) => {
            // 정리기가 상태를 주지 않은 줄 = 어떤 사건도 나오지 않은 줄 → 정산 외. 금액이 있는데 반영되지 않았으면 확인 필요로 보인다
            const missed = missedLines.includes(l.no);
            const st: LineStatus = missed ? "needs_check" : (resolution.lineStatus[l.no] ?? "not_settlement");
            const ov = confirm.lineOverrides[l.no];
            const items = itemsByLine.get(l.no) ?? [];
            const blockers = blockersByLine.get(l.no) ?? [];
            const qs = questionsByLine.get(l.no) ?? [];
            return (
              <li key={l.no} className={`row ${s.line} ${STATUS[st].cls}`}>
                <span className="no">{l.no}</span>
                <div className={s.said}>
                  <p className={s.meta}>
                    <span className={s.who}>{l.speaker ?? "말한 사람 없음"}</span>
                    <span className={s.status}>{STATUS[st].label}</span>
                  </p>
                  <p className={s.text}>{st === "needs_check" ? <span className={`mark ${s.sweep}`}>{l.text}</span> : l.text}</p>
                  {/* 이 줄에서 읽어 낸 항목: 연필 = AI 초안, 파랑 펜 = 총무가 확인하거나 직접 넣은 값 */}
                  {items.map((it) => {
                    const confirmed = it.status === "manual" || it.confirmations.length > 0;
                    return (
                      <p key={it.id} className={s.item}>
                        <span className={confirmed ? "pen" : "pencil"}>
                          {confirmed && <IconCheck />}
                          {it.name} {won(it.amount)}
                        </span>
                        <span className={s.itemInfo}>
                          {it.payer} 결제 · {it.split.length}명({it.split.join("·")})
                        </span>
                        {it.amount > 0 ? (
                          <button type="button" className="textbtn" disabled={busy} onClick={() => fixItem(it)} aria-label={`${it.name} 항목 고치기`}>
                            고치기
                          </button>
                        ) : (
                          <span className={s.itemInfo}>환불돼 부담 없음</span>
                        )}
                      </p>
                    );
                  })}
                  {(blockers.length > 0 || qs.length > 0 || missed) && (
                    <p className={s.tags}>
                      {missed && <span className="mark">금액 {won(amountsByLine.get(l.no)?.[0] ?? 0)} · 반영 안 됨</span>}
                      {blockers.map((b, i) => (
                        <span key={i} className="mark">
                          {isOutOfScope(b.reason) ? "수동 정산" : "확인 필요"}: {BLOCKER_LABEL[b.reason]}
                        </span>
                      ))}
                      {qs.length > 0 && <span className="mark">질문 {qs.length}개</span>}
                    </p>
                  )}
                </div>
                <div className={s.actions}>
                  {ov && manualOnLine(l.no).length > 0 ? (
                    <button
                      type="button"
                      className="textbtn"
                      disabled={busy}
                      onClick={() => revertFix(l.no)}
                      aria-label={`${l.no}줄의 고친 값을 취소하고 AI 판단으로 되돌리기`}
                    >
                      고친 값 취소
                    </button>
                  ) : ov ? (
                    <button
                      type="button"
                      className="textbtn"
                      disabled={busy}
                      onClick={() => setOverride(l.no, null)}
                      aria-label={`${l.no}줄을 처음 판단으로 되돌리기`}
                    >
                      되돌리기
                    </button>
                  ) : missed ? (
                    <>
                      <button
                        type="button"
                        className="textbtn"
                        disabled={busy}
                        onClick={() => addFromLine(l.no, l.speaker)}
                        aria-label={`${l.no}줄로 항목 추가`}
                      >
                        항목 추가
                      </button>
                      <button
                        type="button"
                        className="textbtn"
                        disabled={busy}
                        onClick={() => setOverride(l.no, "not_settlement")}
                        aria-label={`${l.no}줄은 정산과 무관해요`}
                      >
                        정산과 무관해요
                      </button>
                    </>
                  ) : st === "not_settlement" ? (
                    <button
                      type="button"
                      className="textbtn"
                      disabled={busy}
                      onClick={() => addFromLine(l.no, l.speaker)}
                      aria-label={`${l.no}줄로 항목 추가`}
                    >
                      항목 추가
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="textbtn"
                      disabled={busy}
                      onClick={() => setOverride(l.no, "not_settlement")}
                      aria-label={`${l.no}줄을 정산 외로`}
                    >
                      정산 외로
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* 총무 확인값 */}
      {(confirm.answers.length > 0 || confirm.manualItems.length > 0) && (
        <section aria-labelledby="review-confirmed">
          <h2 className="blk sub" id="review-confirmed">
            총무가 확인한 것
          </h2>
          <ul>
            {confirm.answers.map((a) => (
              <li key={a.questionId} className={`row ${s.line}`}>
                {lineOfQuestion(a.questionId) && <span className="no">{lineOfQuestion(a.questionId)}</span>}
                <span className="pen">
                  <IconCheck />
                  질문 답 · {answerLabel(a.value)}
                  {a.amount !== undefined && ` · ${won(a.amount)}`}
                </span>
                <button type="button" className="textbtn" disabled={busy} onClick={() => undoAnswer(a.questionId)}>
                  답 취소
                </button>
              </li>
            ))}
            {confirm.manualItems.map((m, i) => (
              <li key={`m${i}`} className={`row ${s.line}`}>
                {m.lines[0] && <span className="no">{m.lines[0]}</span>}
                <span className="pen">
                  <IconCheck />
                  직접 입력: {m.name} {won(m.amount)} · {m.payer} 결제 · {m.split.join("·")}
                  {m.lines.length > 1 && ` · 근거 ${m.lines.join(", ")}`}
                </span>
                <button
                  type="button"
                  className="textbtn"
                  disabled={busy}
                  onClick={() => removeManual(i)}
                  aria-label={`직접 입력 ${m.name} 빼기`}
                >
                  빼기
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 직접 항목 추가·항목 고치기 */}
      <ManualItemForm roster={roster} lineNos={draft.lines.map((l) => l.no)} busy={busy} onSubmit={submitManual} prefill={prefill} />

      <p className="blk tip">
        <Link className="textbtn" href={`/m/${token}/table`}>
          정산표 보기
        </Link>
      </p>
    </>
  );
}

interface QuoteLine {
  no: string;
  who: string;
  text: string;
}

function QuestionCard({
  q,
  line,
  optionEvidence,
  lineAmounts,
  busy,
  onAnswer,
}: {
  q: Question;
  line?: { no: string; speaker: string | null; text: string };
  /** 선택지 값 → 그 후보 결제의 근거 줄 */
  optionEvidence: Record<string, QuoteLine[]>;
  /** 질문 줄에서 규칙 파서가 읽은 금액들. 하나면 Q-분리 금액 칸에 미리 채우고, 여러 개면 골라 넣게 한다 */
  lineAmounts: number[];
  busy: boolean;
  onAnswer: (a: Answer) => Promise<boolean>;
}) {
  // Q-분리이고 같은 줄에 금액이 있으면(예: "술값은 31,000원") 그 금액을 골라 둔 채로 연다. 총무는 확인만 누르면 된다
  // 금액이 여러 개인 줄(예: "저녁 129,503원 중 술값 31,000원")은 어느 것인지 알 수 없어 미리 채우지 않는다
  const canSplit = q.kind === "split" && q.options.some((o) => o.value === "split");
  const prefilled = canSplit && lineAmounts.length === 1;
  const [value, setValue] = useState(prefilled ? "split" : "");
  const [amount, setAmount] = useState(prefilled ? lineAmounts[0].toLocaleString("ko-KR") : "");
  const [err, setErr] = useState<string | null>(null);
  // Q-분리는 '금액을 입력해 따로 나누기'(value "split")를 골랐을 때만 금액이 필요하다 (A의 resolve.ts 답 형식)
  const needsAmount = q.kind === "split" && value === "split";

  async function submit() {
    if (!value) return setErr("하나를 골라 주세요.");
    let amt: number | undefined;
    if (needsAmount) {
      const n = parseWon(amount);
      if (n === null || n <= 0) return setErr("금액을 원 단위 숫자로 적어 주세요.");
      amt = n;
    }
    setErr(null);
    await onAnswer({ questionId: q.id, value, ...(amt !== undefined ? { amount: amt } : {}) });
  }

  return (
    <article className={`row ${s.q}`}>
      <span className="no">{q.line}</span>
      <p>
        <span className="mark">{KIND_LABEL[q.kind]}</span>
      </p>
      {line && (
        <blockquote className="note">
          {line.speaker ?? "말한 사람 없음"} · {line.text}
        </blockquote>
      )}
      <p className={s.prompt} id={`${q.id}-prompt`}>
        {fixJosa(q.prompt)}
      </p>
      <div className={s.options} role="radiogroup" aria-labelledby={`${q.id}-prompt`}>
        {q.options.map((o) => (
          <label key={o.value} className={value === o.value ? "opt picked" : "opt"}>
            <input type="radio" name={q.id} value={o.value} checked={value === o.value} onChange={() => setValue(o.value)} />
            <span>
              <b>{o.label}</b>
              {(optionEvidence[o.value] ?? []).map((l) => (
                <small key={l.no}>
                  {l.no} {l.who} · {l.text}
                </small>
              ))}
            </span>
          </label>
        ))}
      </div>
      {needsAmount && (
        <div className={s.amount}>
          <label>
            <span className="label">뺄 금액</span>
            <input
              className="input"
              name="amount"
              inputMode="numeric"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="예: 12,000…"
            />
          </label>
          {prefilled && <p className="note">대화에서 읽은 금액을 넣어 뒀어요. 다르면 고쳐 주세요.</p>}
          {canSplit && lineAmounts.length > 1 && (
            <p className={s.picks}>
              <span className="note">대화에 나온 금액:</span>
              {lineAmounts.map((a) => (
                <button key={a} type="button" className={s.pick} onClick={() => setAmount(a.toLocaleString("ko-KR"))}>
                  {won(a)}
                </button>
              ))}
            </p>
          )}
        </div>
      )}
      {err && (
        <p className="alert" role="alert">
          {err}
        </p>
      )}
      <button type="button" className="btn wide" disabled={busy} onClick={submit}>
        이렇게 확인
      </button>
    </article>
  );
}

/** 항목 고치기 대상 */
interface FixTarget {
  /** 고치는 항목의 원래 이름 (제목에 표시) */
  itemName: string;
  name: string;
  split: Alias[];
  /** 원래 항목의 근거 줄. 저장하면 이 줄들의 AI 판단은 무시하고 고친 항목으로 대신한다 */
  lines: string[];
  /** 같은 줄에서 나와 함께 사라지는 다른 항목 이름 */
  alsoRemoved: string[];
  /** 직접 입력 항목을 고치는 경우 그 항목의 순서 (M1 → 0) */
  manualIndex?: number;
}

interface FormPrefill {
  /** 같은 값으로 다시 눌러도 폼이 다시 채워지도록 누를 때마다 1씩 늘린다 */
  n: number;
  line: string;
  payer: string;
  amount?: number;
  /** 따로 나눌 부분의 근거 줄 추천 (반영 안 된 금액 줄) */
  partLine: string;
  fix: FixTarget | null;
}

function ManualItemForm({
  roster,
  lineNos,
  busy,
  onSubmit,
  prefill,
}: {
  roster: Alias[];
  lineNos: string[];
  busy: boolean;
  onSubmit: (items: ManualItem[], fix: FixTarget | null) => Promise<boolean>;
  prefill: FormPrefill | null;
}) {
  const [open, setOpen] = useState(false);
  const [fix, setFix] = useState<FixTarget | null>(null);
  const [name, setName] = useState("");
  const [payer, setPayer] = useState("");
  const [amount, setAmount] = useState("");
  const [split, setSplit] = useState<Alias[]>(roster);
  const [line, setLine] = useState("");
  // 일부 금액을 따로 나누기 (예: 술값을 안 마신 사람 빼고)
  const [partOn, setPartOn] = useState(false);
  const [partName, setPartName] = useState("주류");
  const [partAmount, setPartAmount] = useState("");
  const [partOut, setPartOut] = useState<Alias[]>([]);
  const [partLine, setPartLine] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const reset = () => {
    setFix(null);
    setName("");
    setPayer("");
    setAmount("");
    setSplit(roster);
    setLine("");
    setPartOn(false);
    setPartName("주류");
    setPartAmount("");
    setPartOut([]);
    setPartLine("");
    setErr(null);
  };

  // ‘항목 추가’·‘고치기’를 누르면 값을 채워 폼을 열고 화면을 폼으로 옮긴다
  useEffect(() => {
    if (!prefill) return;
    reset();
    setOpen(true);
    setLine(prefill.line);
    if (prefill.payer) setPayer(prefill.payer);
    if (prefill.amount) setAmount(prefill.amount.toLocaleString("ko-KR"));
    setPartLine(prefill.partLine);
    if (prefill.fix) {
      setFix(prefill.fix);
      setName(prefill.fix.name);
      setSplit(roster.filter((r) => prefill.fix!.split.includes(r)));
    }
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const inRosterOrder = (xs: Alias[]) => roster.filter((r) => xs.includes(r));
  const toggle = (a: Alias) => setSplit((cur) => inRosterOrder(cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  const togglePartOut = (a: Alias) =>
    setPartOut((cur) => inRosterOrder(cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  const total = parseWon(amount);
  const part = partOn ? parseWon(partAmount) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("항목 이름을 적어 주세요.");
    if (!payer) return setErr("결제한 사람을 골라 주세요.");
    if (total === null || total <= 0) return setErr("금액을 원 단위 숫자로 적어 주세요.");
    if (split.length === 0) return setErr("나눠 낼 사람을 한 명 이상 골라 주세요.");
    const lines = fix ? fix.lines : line ? [line] : [];
    const main: ManualItem = { name: name.trim(), payer, amount: total, split, lines };
    const items: ManualItem[] = [main];
    if (partOn) {
      const rest = split.filter((a) => !partOut.includes(a));
      if (!partName.trim()) return setErr("따로 나눌 부분의 이름을 적어 주세요. (예: 주류)");
      if (part === null || part <= 0) return setErr("따로 나눌 금액을 원 단위 숫자로 적어 주세요.");
      if (part >= total) return setErr("따로 나눌 금액은 전체 금액보다 작아야 해요.");
      if (partOut.length === 0) return setErr("그 부분에서 빠질 사람을 골라 주세요.");
      if (rest.length === 0) return setErr("그 부분을 나눠 낼 사람이 한 명은 남아야 해요.");
      // 식사비 + 따로 나눈 부분 = 원 결제액 (발표 10쪽)
      main.amount = total - part;
      items.push({
        name: `${name.trim()} (${partName.trim()})`,
        payer,
        amount: part,
        split: rest,
        lines: partLine && !lines.includes(partLine) ? [...lines, partLine] : lines,
      });
    }
    setErr(null);
    const ok = await onSubmit(items, fix);
    if (ok) {
      reset();
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <div className="blk stack">
        <button
          type="button"
          className="btn ghost wide"
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          직접 항목 추가
        </button>
      </div>
    );
  }

  return (
    <form className={`blk stack ${s.manual}`} onSubmit={submit} ref={formRef}>
      <h2 className={s.formTitle}>{fix ? `항목 고치기 · ${fix.itemName}` : "직접 항목 추가"}</h2>
      {fix && fix.manualIndex === undefined && (
        <p className="caution">
          저장하면 {fix.lines.join(", ")}줄의 AI 판단 대신 아래 값으로 정산해요.
          {fix.alsoRemoved.length > 0 && ` 같은 줄에서 나온 ‘${fix.alsoRemoved.join("’, ‘")}’도 함께 빠지니, 필요하면 다시 추가해 주세요.`}
        </p>
      )}
      <label>
        <span className="label">항목</span>
        <input
          className="input"
          name="item"
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 노래방…"
          maxLength={20}
        />
      </label>
      <label>
        <span className="label">금액 (전체)</span>
        <input
          className="input"
          name="amount"
          inputMode="numeric"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="예: 30,000…"
        />
      </label>
      <label>
        <span className="label">결제한 사람</span>
        <select className="select" name="payer" value={payer} onChange={(e) => setPayer(e.target.value)}>
          <option value="">고르기</option>
          {roster.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="label">나눠 낼 사람 ({split.length}명)</legend>
        <div className={s.chips}>
          {roster.map((a) => (
            <label key={a} className={split.includes(a) ? `${s.chip} ${s.chipOn}` : s.chip}>
              <input type="checkbox" name="split" value={a} checked={split.includes(a)} onChange={() => toggle(a)} />
              {a}
            </label>
          ))}
        </div>
      </fieldset>

      <label className={partOn ? "opt picked" : "opt"}>
        <input type="checkbox" name="part" checked={partOn} onChange={(e) => setPartOn(e.target.checked)} />
        <span>일부 금액은 몇 명을 빼고 따로 나누기 (예: 술 안 마신 사람)</span>
      </label>
      {partOn && (
        <div className={s.part}>
          <label>
            <span className="label">따로 나눌 부분</span>
            <input
              className="input"
              name="part-name"
              autoComplete="off"
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              placeholder="예: 주류…"
              maxLength={10}
            />
          </label>
          <label>
            <span className="label">그 부분 금액</span>
            <input
              className="input"
              name="part-amount"
              inputMode="numeric"
              autoComplete="off"
              value={partAmount}
              onChange={(e) => setPartAmount(e.target.value)}
              placeholder="예: 31,000…"
            />
          </label>
          <fieldset>
            <legend className="label">그 부분에서 빠질 사람</legend>
            <div className={s.chips}>
              {split.map((a) => (
                <label key={a} className={partOut.includes(a) ? `${s.chip} ${s.chipOn}` : s.chip}>
                  <input type="checkbox" name="part-out" value={a} checked={partOut.includes(a)} onChange={() => togglePartOut(a)} />
                  {a}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            <span className="label">그 부분의 근거 줄 (선택)</span>
            <select className="select" name="part-line" value={partLine} onChange={(e) => setPartLine(e.target.value)}>
              <option value="">없음</option>
              {lineNos.map((no) => (
                <option key={no} value={no}>
                  {no}줄
                </option>
              ))}
            </select>
          </label>
          {total !== null && part !== null && part > 0 && part < total && (
            <p className={`pen num ${s.partSum}`}>
              {name.trim() || "항목"} {won(total - part)} ({split.length}명) + {partName.trim() || "부분"} {won(part)} (
              {split.filter((a) => !partOut.includes(a)).length}명) = {won(total)}
            </p>
          )}
        </div>
      )}

      {!fix && (
        <label>
          <span className="label">근거 줄 (선택)</span>
          <select className="select" name="line" value={line} onChange={(e) => setLine(e.target.value)}>
            <option value="">없음 · 총무 확인</option>
            {lineNos.map((no) => (
              <option key={no} value={no}>
                {no}줄
              </option>
            ))}
          </select>
        </label>
      )}
      {err && (
        <p className="alert" role="alert">
          {err}
        </p>
      )}
      <div className={s.formActions}>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          취소
        </button>
        <button type="submit" className="btn" disabled={busy}>
          {fix ? "이렇게 고치기" : "추가"}
        </button>
      </div>
    </form>
  );
}
