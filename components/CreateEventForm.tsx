"use client";

/**
 * S1 행사 만들기 폼 — 담당: C
 * 행사 이름 + 참여자 별칭(순서 고정) → POST /api/events → 관리 링크 안내
 */
import { useState } from "react";
import type { ApiError, CreateEventRequest, CreateEventResponse } from "@/lib/api";
import s from "./CreateEventForm.module.css";

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

export function CreateEventForm() {
  const [name, setName] = useState("");
  const [roster, setRoster] = useState<string[]>(["", "", ""]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreateEventResponse | null>(null);
  const [copied, setCopied] = useState<"admin" | "result" | null>(null);

  // 고치기 시작하면 지난 오류 안내는 지운다 (다시 누르면 새로 검사)
  const setAlias = (i: number, v: string) => {
    setErrors([]);
    setRoster((r) => r.map((a, j) => (j === i ? v : a)));
  };
  const move = (i: number, d: -1 | 1) =>
    setRoster((r) => {
      const j = i + d;
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (i: number) => setRoster((r) => (r.length <= MIN_PEOPLE ? r : r.filter((_, j) => j !== i)));
  const add = () => setRoster((r) => (r.length >= MAX_PEOPLE ? r : [...r, ""]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs = validate(name, roster);
    setErrors(errs);
    if (errs.length > 0) return;

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
      <section className={s.done} aria-live="polite">
        <h2>행사를 만들었어요</h2>

        <div className={s.linkBox}>
          <p className={s.label}>관리 링크 · 총무 전용</p>
          <p className={s.url}>{adminUrl}</p>
          <button type="button" className={s.secondary} onClick={() => copy("admin", adminUrl)}>
            {copied === "admin" ? "복사했어요" : "관리 링크 복사"}
          </button>
          <ul className={s.warn}>
            <li>이 링크로만 다시 들어올 수 있어요. 메모나 나에게 보내기로 꼭 저장해 두세요.</li>
            <li>다른 사람에게 보내지 마세요. 링크가 있으면 누구나 정산을 고칠 수 있어요.</li>
          </ul>
        </div>

        <div className={s.linkBox}>
          <p className={s.label}>결과 링크 · 모임원용 (발행한 뒤에 열려요)</p>
          <p className={s.url}>{resultUrl}</p>
          <button type="button" className={s.secondary} onClick={() => copy("result", resultUrl)}>
            {copied === "result" ? "복사했어요" : "결과 링크 복사"}
          </button>
        </div>

        <a className={s.primary} href={`/m/${created.adminToken}/paste`}>
          대화 붙여넣기로 가기
        </a>
      </section>
    );
  }

  const filledCount = roster.filter((a) => a.trim()).length;

  return (
    <form className={s.form} onSubmit={submit} noValidate>
      <label className={s.field}>
        <span>행사 이름</span>
        <input
          value={name}
          onChange={(e) => {
            setErrors([]);
            setName(e.target.value);
          }}
          placeholder="예: 동아리 뒤풀이"
          maxLength={MAX_NAME}
          autoComplete="off"
        />
      </label>

      <fieldset className={s.field}>
        <legend>참여자 ({filledCount}명)</legend>
        <p className={s.hint}>
          결과 링크에 보일 이름이에요. 실명 대신 별칭도 괜찮아요.
          <br />
          나누어떨어지지 않는 1원은 <strong>이 순서대로</strong> 앞사람부터 붙어요.
        </p>
        <ol className={s.roster}>
          {roster.map((alias, i) => (
            <li key={i}>
              <span className={s.order}>{i + 1}</span>
              <input
                value={alias}
                onChange={(e) => setAlias(i, e.target.value)}
                placeholder={`참여자 ${i + 1}`}
                maxLength={MAX_ALIAS}
                aria-label={`참여자 ${i + 1} 별칭`}
                autoComplete="off"
              />
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${i + 1}번을 위로`}>
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === roster.length - 1}
                aria-label={`${i + 1}번을 아래로`}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={roster.length <= MIN_PEOPLE}
                aria-label={`${i + 1}번 빼기`}
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
        {roster.length < MAX_PEOPLE && (
          <button type="button" className={s.add} onClick={add}>
            + 참여자 추가
          </button>
        )}
      </fieldset>

      {errors.length > 0 && (
        <ul className={s.errors} role="alert">
          {errors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <button type="submit" className={s.primary} disabled={busy}>
        {busy ? "만드는 중…" : "행사 만들기"}
      </button>
    </form>
  );
}
