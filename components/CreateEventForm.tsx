"use client";

/**
 * S1 행사 만들기 — 담당: C
 * 행사 이름 + 참여자 별칭(순서 고정) → POST /api/events → 관리 링크 안내
 * iOS 연락처 편집처럼: 빨간 빼기 단추로 지우고, 오른쪽 손잡이를 끌어(또는 위아래 화살표로) 순서를 바꾼다.
 * 명단 순서는 나누어떨어지지 않는 1원이 붙는 순서다.
 */
import { useEffect, useRef, useState } from "react";
import type { ApiError, CreateEventRequest, CreateEventResponse } from "@/lib/api";
import s from "./CreateEventForm.module.css";
import { IconCheckCircle, IconCopy, IconGrip, IconMinusCircle, IconPlus, IconWarn } from "./icons";

export const MIN_PEOPLE = 2;
export const MAX_PEOPLE = 10;
export const MAX_ALIAS = 10;
export const MAX_NAME = 40;

/** 입력값 검사. 문제가 없으면 빈 배열 */
export function validate(name: string, roster: string[]): string[] {
  const errors: string[] = [];
  const aliases = roster.map((a) => a.trim());
  if (!name.trim()) errors.push("행사 이름을 적어 주세요.");
  if (name.trim().length > MAX_NAME) errors.push(`행사 이름은 ${MAX_NAME}자까지예요.`);
  const filled = aliases.filter(Boolean);
  if (filled.length < MIN_PEOPLE) errors.push(`참여자를 ${MIN_PEOPLE}명 이상 적어 주세요.`);
  if (filled.length > MAX_PEOPLE) errors.push(`참여자는 ${MAX_PEOPLE}명까지예요.`);
  if (filled.some((a) => a.length > MAX_ALIAS)) errors.push(`별칭은 ${MAX_ALIAS}자까지예요.`);
  const dup = filled.filter((a, i) => filled.indexOf(a) !== i);
  if (dup.length > 0) errors.push(`같은 별칭이 있어요: ${[...new Set(dup)].join(", ")}`);
  return errors;
}

/** 결과 링크 토큰은 생성할 때 한 번만 받는다 → 발행 화면(S5)에서 쓰도록 이 브라우저에 보관 */
function rememberResultToken(eventId: string, resultToken: string) {
  try {
    localStorage.setItem(`daechong:result:${eventId}`, resultToken);
  } catch {
    // 사파리 개인정보 보호 모드 등에서는 저장이 막힐 수 있다. 화면의 결과 링크 안내로 대신한다.
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** 끌어서 순서 바꾸기: 손잡이를 잡은 줄과 처음 잡은 높이 */
interface Drag {
  index: number;
  startY: number;
  rowH: number;
  pointerId: number;
}

export function CreateEventForm() {
  const [name, setName] = useState("");
  const [roster, setRoster] = useState<string[]>(["", "", ""]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreateEventResponse | null>(null);
  const [copied, setCopied] = useState<"admin" | "result" | null>(null);
  const [dragging, setDragging] = useState<{ index: number; offset: number } | null>(null);
  const [focusGrip, setFocusGrip] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const drag = useRef<Drag | null>(null);
  const grips = useRef<(HTMLButtonElement | null)[]>([]);

  // 화살표로 옮긴 뒤에는 옮겨 간 줄의 손잡이에 그대로 머문다
  useEffect(() => {
    if (focusGrip === null) return;
    grips.current[focusGrip]?.focus();
    setFocusGrip(null);
  }, [focusGrip]);

  // 고치기 시작하면 지난 오류 안내는 지운다 (다시 누르면 새로 검사)
  const setAlias = (i: number, v: string) => {
    setErrors([]);
    setRoster((r) => r.map((a, j) => (j === i ? v : a)));
  };
  const moveTo = (from: number, to: number) =>
    setRoster((r) => {
      if (to < 0 || to >= r.length || to === from) return r;
      const next = [...r];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  const remove = (i: number) => setRoster((r) => (r.length <= MIN_PEOPLE ? r : r.filter((_, j) => j !== i)));
  const add = () => setRoster((r) => (r.length >= MAX_PEOPLE ? r : [...r, ""]));

  function gripDown(e: React.PointerEvent<HTMLButtonElement>, i: number) {
    const row = e.currentTarget.closest("li");
    if (!row) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { index: i, startY: e.clientY, rowH: row.offsetHeight, pointerId: e.pointerId };
    setDragging({ index: i, offset: 0 });
  }
  function gripMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const last = roster.length - 1;
    const target = Math.max(0, Math.min(last, d.index + Math.round((e.clientY - d.startY) / d.rowH)));
    if (target !== d.index) {
      moveTo(d.index, target);
      d.startY += (target - d.index) * d.rowH;
      d.index = target;
    }
    // 목록 밖으로는 끌려 나가지 않는다
    const offset = Math.max(-d.index * d.rowH, Math.min((last - d.index) * d.rowH, e.clientY - d.startY));
    setDragging({ index: d.index, offset });
  }
  function gripUp() {
    drag.current = null;
    setDragging(null);
  }
  function gripKey(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const to = e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : null;
    if (to === null || to < 0 || to >= roster.length) return;
    e.preventDefault();
    moveTo(i, to);
    setFocusGrip(to);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs = validate(name, roster);
    setErrors(errs);
    if (errs.length > 0) {
      // 고칠 칸으로 바로 옮긴다: 이름이 문제면 이름, 아니면 첫 참여자 칸
      const nameBad = !name.trim() || name.trim().length > MAX_NAME;
      formRef.current?.querySelector<HTMLInputElement>(nameBad ? "#event-name" : 'input[name="alias-0"]')?.focus();
      return;
    }

    const body: CreateEventRequest = {
      name: name.trim(),
      roster: roster.map((a) => a.trim()).filter(Boolean),
    };
    setBusy(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as CreateEventResponse | ApiError | null;
      if (!res.ok || !data || "error" in data) {
        setErrors([data && "error" in data ? data.error : "행사를 만들지 못했어요. 잠시 뒤 다시 해 주세요."]);
        return;
      }
      rememberResultToken(data.eventId, data.resultToken);
      setCreated(data);
    } catch {
      setErrors(["인터넷 연결을 확인하고 다시 해 주세요."]);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const adminUrl = `${origin}/m/${created.adminToken}`;
    const resultUrl = `${origin}/r/${created.resultToken}`;
    const copy = async (which: "admin" | "result", text: string) => {
      if (await copyText(text)) setCopied(which);
    };
    return (
      <div className={s.form} aria-live="polite">
        <div className={s.head}>
          <span className={s.grabber} aria-hidden="true" />
          <IconCheckCircle className={s.doneIcon} />
          <h2 className={s.title}>행사를 만들었어요</h2>
        </div>

        <section className="section">
          <h3 className="section-header">관리 링크 · 총무 전용</h3>
          <div className="group">
            <div className="cell">
              <span className={`cell-main ${s.url}`}>{adminUrl}</span>
              <button type="button" className="btn gray small" onClick={() => copy("admin", adminUrl)}>
                <IconCopy />
                {copied === "admin" ? "복사했어요" : "복사"}
              </button>
            </div>
          </div>
          <div className={`card warn ${s.warn}`}>
            <p className="card-title">
              <IconWarn />
              이 링크를 꼭 저장해 두세요
            </p>
            <ul className="dots">
              <li>이 링크로만 다시 들어올 수 있어요. 메모나 나에게 보내기로 저장해 두세요.</li>
              <li>다른 사람에게 보내지 마세요. 링크가 있으면 누구나 정산을 고칠 수 있어요.</li>
            </ul>
          </div>
        </section>

        <section className="section">
          <h3 className="section-header">결과 링크 · 모임원용</h3>
          <div className="group">
            <div className="cell">
              <span className={`cell-main ${s.url}`}>{resultUrl}</span>
              <button type="button" className="btn gray small" onClick={() => copy("result", resultUrl)}>
                <IconCopy />
                {copied === "result" ? "복사했어요" : "복사"}
              </button>
            </div>
          </div>
          <p className="section-footer">발행한 뒤에 열려요.</p>
        </section>

        <div className="actions">
          <a className="btn wide" href={`/m/${created.adminToken}/paste`}>
            대화 붙여넣기
          </a>
        </div>
      </div>
    );
  }

  const filledCount = roster.filter((a) => a.trim()).length;

  return (
    <form className={s.form} onSubmit={submit} noValidate ref={formRef}>
      <div className={s.head}>
        <span className={s.grabber} aria-hidden="true" />
        <h2 className={s.title}>새 행사</h2>
      </div>

      <section className="section">
        <label className="section-header" htmlFor="event-name">
          행사 이름
        </label>
        <div className="group">
          <div className="cell">
            <input
              id="event-name"
              name="event-name"
              className="input"
              value={name}
              onChange={(e) => {
                setErrors([]);
                setName(e.target.value);
              }}
              placeholder="예: 동아리 뒤풀이"
              maxLength={MAX_NAME}
              autoComplete="off"
            />
          </div>
        </div>
      </section>

      <section className="section" role="group" aria-labelledby="roster-title">
        <h3 className="section-header" id="roster-title">
          참여자<span className="count">{filledCount}명</span>
        </h3>
        <ol className={`group ${s.roster}`}>
          {roster.map((alias, i) => (
            <li
              key={i}
              className={dragging?.index === i ? `cell ${s.person} ${s.lifted}` : `cell ${s.person}`}
              style={dragging?.index === i ? { transform: `translateY(${dragging.offset}px)` } : undefined}
            >
              <button
                type="button"
                className={s.remove}
                onClick={() => remove(i)}
                disabled={roster.length <= MIN_PEOPLE}
                aria-label={`${i + 1}번 빼기`}
              >
                <IconMinusCircle />
              </button>
              <input
                className="input"
                name={`alias-${i}`}
                value={alias}
                onChange={(e) => setAlias(i, e.target.value)}
                placeholder={`참여자 ${i + 1}`}
                maxLength={MAX_ALIAS}
                aria-label={`참여자 ${i + 1} 별칭`}
                autoComplete="off"
              />
              <button
                type="button"
                className={s.grip}
                ref={(el) => {
                  grips.current[i] = el;
                }}
                onPointerDown={(e) => gripDown(e, i)}
                onPointerMove={gripMove}
                onPointerUp={gripUp}
                onPointerCancel={gripUp}
                onKeyDown={(e) => gripKey(e, i)}
                aria-label={`${i + 1}번 순서 바꾸기. 위아래 화살표로 옮겨요`}
              >
                <IconGrip />
              </button>
            </li>
          ))}
          {roster.length < MAX_PEOPLE && (
            <li>
              <button type="button" className={`cell tap ${s.add}`} onClick={add}>
                <IconPlus />
                참여자 추가
              </button>
            </li>
          )}
        </ol>
        <p className="section-footer">
          결과 링크에 보일 이름이에요. 실명 대신 별칭도 괜찮아요. 나누어떨어지지 않는 1원은 <strong>이 순서대로</strong> 앞사람부터 붙어요.
        </p>
      </section>

      {errors.length > 0 && (
        <div className={`card err ${s.errors}`} role="alert">
          <ul className="dots">
            {errors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="actions">
        <button type="submit" className="btn wide" disabled={busy}>
          {busy ? "만드는 중…" : "행사 만들기"}
        </button>
      </div>
    </form>
  );
}
