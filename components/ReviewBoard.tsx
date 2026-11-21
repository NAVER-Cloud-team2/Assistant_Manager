"use client";

/**
 * S3 검토 — 담당: C (구현계획서 3장 S3, 4-3)
 * 줄 번호 붙은 발언을 ‘확정 후보 / 확인 필요 / 정산 외’로 표시, 질문 카드, 직접 항목 추가, 줄 분류 바꾸기.
 * 총무의 답·직접 입력은 확인값으로 저장되고 AI 사건보다 우선한다. 저장할 때마다 서버가 다시 정리·계산한다.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { ADMIN_HEADER, type AnswersRequest, type ApiError } from "@/lib/api";
import type { Alias, Answer, Blocker, Draft, LineStatus, ManualItem, Question } from "@/lib/types";
import { won } from "./format";
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
  const [draft, setDraft] = useState(initialDraft);
  const [confirm, setConfirm] = useState(initialConfirm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { resolution } = draft;
  const itemsByLine = useMemo(() => {
    const m = new Map<string, { id: string; name: string }[]>();
    for (const it of resolution.items) for (const no of it.evidence) m.set(no, [...(m.get(no) ?? []), { id: it.id, name: it.name }]);
    return m;
  }, [resolution.items]);
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
  const addManual = (m: ManualItem) => save({ ...confirm, manualItems: [...confirm.manualItems, m] });
  const removeManual = (i: number) => save({ ...confirm, manualItems: confirm.manualItems.filter((_, j) => j !== i) });
  const setOverride = (no: string, v: "candidate" | "not_settlement" | null) => {
    const next: Overrides = { ...confirm.lineOverrides };
    if (v) next[no] = v;
    else delete next[no];
    return save({ ...confirm, lineOverrides: next });
  };

  /** 답 값이 항목 id면 항목 이름으로 보여 준다 (P1 → 저녁) */
  const answerLabel = (v: string) => {
    const it = resolution.items.find((x) => x.id === v);
    return it ? it.name : v;
  };

  const unresolved = resolution.questions.length;
  const blocked = resolution.blockers.filter((b) => b.reason !== "unresolved_question").length;

  return (
    <div className={s.board}>
      {/* 상태 요약 */}
      {draft.aiFailed ? (
        <section className={`${s.banner} ${s.warn}`}>
          <strong>AI 분석에 실패했어요</strong>
          <p>아래 ‘직접 항목 추가’로 결제를 넣어 주세요. 붙여넣은 대화는 근거로 고를 수 있어요.</p>
        </section>
      ) : (
        draft.aiDraft && <p className={s.badge}>AI 추출 초안 · 확인한 뒤 발행해요</p>
      )}

      <section className={`${s.banner} ${draft.publishable ? s.ok : s.warn}`} aria-live="polite">
        {draft.publishable ? (
          <>
            <strong>발행할 수 있어요</strong>
            <p>
              <Link href={`/m/${token}/table`}>정산표 확인</Link> · <Link href={`/m/${token}/publish`}>발행하러 가기</Link>
            </p>
          </>
        ) : (
          <>
            <strong>아직 발행할 수 없어요</strong>
            <ul>
              {unresolved > 0 && <li>답할 질문 {unresolved}개</li>}
              {blocked > 0 && <li>수동 정산이 필요한 줄 {blocked}개 (외화·선입금 등)</li>}
              {resolution.items.length === 0 && <li>정산할 항목이 없어요</li>}
              {unresolved === 0 && blocked === 0 && resolution.items.length > 0 && <li>항목 정보나 검산을 확인해 주세요 (정산표)</li>}
            </ul>
          </>
        )}
      </section>

      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}

      {/* 질문 카드 */}
      {resolution.questions.length > 0 && (
        <section>
          <h2>확인이 필요한 것 ({resolution.questions.length})</h2>
          <div className={s.questions}>
            {resolution.questions.map((q) => (
              <QuestionCard key={q.id} q={q} line={draft.lines.find((l) => l.no === q.line)} busy={busy} onAnswer={answer} />
            ))}
          </div>
        </section>
      )}

      {/* 발언 목록 */}
      <section>
        <h2>붙여넣은 대화</h2>
        <ol className={s.lines}>
          {draft.lines.map((l) => {
            const st = resolution.lineStatus[l.no] ?? "candidate";
            const ov = confirm.lineOverrides[l.no];
            const items = itemsByLine.get(l.no) ?? [];
            const blockers = blockersByLine.get(l.no) ?? [];
            const qs = questionsByLine.get(l.no) ?? [];
            return (
              <li key={l.no} className={`${s.line} ${STATUS[st].cls}`}>
                <div className={s.lineHead}>
                  <span className={s.no}>{l.no}</span>
                  <span className={s.who}>{l.speaker ?? "말한 사람 없음"}</span>
                  <span className={s.status}>{STATUS[st].label}</span>
                </div>
                <p className={s.text}>{l.text}</p>
                {(items.length > 0 || blockers.length > 0 || qs.length > 0) && (
                  <div className={s.tags}>
                    {items.map((it) => (
                      <span key={it.id} className={s.tag}>
                        {it.name}
                      </span>
                    ))}
                    {blockers.map((b, i) => (
                      <span key={i} className={`${s.tag} ${s.tagWarn}`}>
                        수동 정산: {BLOCKER_LABEL[b.reason]}
                      </span>
                    ))}
                    {qs.length > 0 && <span className={`${s.tag} ${s.tagWarn}`}>질문 {qs.length}개</span>}
                  </div>
                )}
                <div className={s.lineActions}>
                  {st === "not_settlement" ? (
                    <button type="button" disabled={busy} onClick={() => setOverride(l.no, "candidate")}>
                      정산에 넣기
                    </button>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => setOverride(l.no, "not_settlement")}>
                      정산 외로
                    </button>
                  )}
                  {ov && (
                    <button type="button" disabled={busy} onClick={() => setOverride(l.no, null)}>
                      처음 판단으로 되돌리기
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
        <section>
          <h2>총무가 확인한 것</h2>
          <ul className={s.confirmed}>
            {confirm.answers.map((a) => (
              <li key={a.questionId}>
                <span>
                  질문 답 · {answerLabel(a.value)}
                  {a.amount !== undefined && ` · ${won(a.amount)}`}
                </span>
                <button type="button" disabled={busy} onClick={() => undoAnswer(a.questionId)}>
                  답 취소
                </button>
              </li>
            ))}
            {confirm.manualItems.map((m, i) => (
              <li key={`m${i}`}>
                <span>
                  직접 입력: {m.name} {won(m.amount)} · {m.payer} 결제 · {m.split.join("·")}
                  {m.lines.length > 0 && ` · 근거 ${m.lines.join(", ")}`}
                </span>
                <button type="button" disabled={busy} onClick={() => removeManual(i)}>
                  빼기
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 직접 항목 추가 */}
      <ManualItemForm roster={roster} lineNos={draft.lines.map((l) => l.no)} busy={busy} onAdd={addManual} />

      <p className={s.footer}>
        <Link href={`/m/${token}/table`}>정산표 보기 →</Link>
      </p>
    </div>
  );
}

function QuestionCard({
  q,
  line,
  busy,
  onAnswer,
}: {
  q: Question;
  line?: { no: string; speaker: string | null; text: string };
  busy: boolean;
  onAnswer: (a: Answer) => Promise<boolean>;
}) {
  const [value, setValue] = useState("");
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const needsAmount = q.kind === "split";

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
    <article className={s.qcard}>
      <p className={s.qkind}>
        {KIND_LABEL[q.kind]} · {q.line}줄
      </p>
      {line && (
        <blockquote className={s.quote}>
          <b>{line.speaker ?? "말한 사람 없음"}</b> {line.text}
        </blockquote>
      )}
      <p className={s.prompt}>{q.prompt}</p>
      <div className={s.options} role="radiogroup" aria-label={q.prompt}>
        {q.options.map((o) => (
          <label key={o.value} className={value === o.value ? s.picked : undefined}>
            <input type="radio" name={q.id} value={o.value} checked={value === o.value} onChange={() => setValue(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
      {needsAmount && (
        <label className={s.amount}>
          <span>뺄 금액</span>
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="예: 12,000" />
        </label>
      )}
      {err && <p className={s.fieldError}>{err}</p>}
      <button type="button" className={s.primary} disabled={busy} onClick={submit}>
        이렇게 확인
      </button>
    </article>
  );
}

function ManualItemForm({
  roster,
  lineNos,
  busy,
  onAdd,
}: {
  roster: Alias[];
  lineNos: string[];
  busy: boolean;
  onAdd: (m: ManualItem) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [payer, setPayer] = useState("");
  const [amount, setAmount] = useState("");
  const [split, setSplit] = useState<Alias[]>(roster);
  const [line, setLine] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const toggle = (a: Alias) =>
    setSplit((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : roster.filter((r) => r === a || cur.includes(r))));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseWon(amount);
    if (!name.trim()) return setErr("항목 이름을 적어 주세요.");
    if (!payer) return setErr("결제한 사람을 골라 주세요.");
    if (n === null || n <= 0) return setErr("금액을 원 단위 숫자로 적어 주세요.");
    if (split.length === 0) return setErr("나눠 낼 사람을 한 명 이상 골라 주세요.");
    setErr(null);
    const ok = await onAdd({ name: name.trim(), payer, amount: n, split, lines: line ? [line] : [] });
    if (ok) {
      setName("");
      setAmount("");
      setLine("");
      setSplit(roster);
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={s.secondary} onClick={() => setOpen(true)}>
        + 직접 항목 추가
      </button>
    );
  }

  return (
    <form className={s.manual} onSubmit={submit}>
      <h2>직접 항목 추가</h2>
      <label>
        <span>항목</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 노래방" maxLength={20} />
      </label>
      <label>
        <span>금액</span>
        <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="예: 30,000" />
      </label>
      <label>
        <span>결제한 사람</span>
        <select value={payer} onChange={(e) => setPayer(e.target.value)}>
          <option value="">고르기</option>
          {roster.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>나눠 낼 사람 ({split.length}명)</legend>
        <div className={s.chips}>
          {roster.map((a) => (
            <label key={a} className={split.includes(a) ? s.picked : undefined}>
              <input type="checkbox" checked={split.includes(a)} onChange={() => toggle(a)} />
              {a}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        <span>근거 줄 (선택)</span>
        <select value={line} onChange={(e) => setLine(e.target.value)}>
          <option value="">없음 · 총무 확인</option>
          {lineNos.map((no) => (
            <option key={no} value={no}>
              {no}줄
            </option>
          ))}
        </select>
      </label>
      {err && <p className={s.fieldError}>{err}</p>}
      <div className={s.formActions}>
        <button type="button" className={s.secondary} onClick={() => setOpen(false)}>
          취소
        </button>
        <button type="submit" className={s.primary} disabled={busy}>
          추가
        </button>
      </div>
    </form>
  );
}
