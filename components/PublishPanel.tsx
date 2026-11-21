"use client";

/**
 * S5 확정·발행 — 담당: C (구현계획서 3장 S5, 4-5)
 * 이전 공유 여부 → 새 판 발행 → 문구 복사(결과 링크를 넣어서). 2판부터 변동액. ‘모두 지우기’.
 * 문구에는 원 발언을 넣지 않는다(문구는 A의 version.ts가 만든다).
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { ADMIN_HEADER, type ApiError, type PublishRequest, type PublishResponse } from "@/lib/api";
import type { PriorShared, Version } from "@/lib/types";
import { RESULT_URL_PLACEHOLDER } from "@/lib/version";
import { dateTime, signedNum, won } from "./format";
import s from "./PublishPanel.module.css";
import { Seal } from "./Seal";

const RESULT_KEY = (eventId: string) => `daechong:result:${eventId}`;
const RESULT_TOKEN_RE = /\/r\/([A-Za-z0-9_-]{16,})/;

const PRIOR: { value: PriorShared; label: string; hint: string }[] = [
  { value: "없음", label: "없어요", hint: "송금안까지 함께 보내요" },
  { value: "있음", label: "있어요", hint: "다시 송금하라는 안내 없이 바뀐 금액만 보내요" },
  { value: "모름", label: "잘 모르겠어요", hint: "안전하게 바뀐 금액만 보내요" },
];

function readToken(eventId: string): string | null {
  try {
    return localStorage.getItem(RESULT_KEY(eventId));
  } catch {
    return null;
  }
}
function saveToken(eventId: string, token: string | null) {
  try {
    if (token) localStorage.setItem(RESULT_KEY(eventId), token);
    else localStorage.removeItem(RESULT_KEY(eventId));
  } catch {
    // 저장이 막힌 브라우저: 이번 화면에서만 쓴다
  }
}

/** 문구의 {{RESULT_URL}}을 실제 결과 링크로. 링크를 모르면 안내 문장으로 바꾼다. */
export function fillMessage(message: string, resultUrl: string | null): string {
  return message.split(RESULT_URL_PLACEHOLDER).join(resultUrl ?? "(결과 링크를 여기에 붙여 주세요)");
}

export function PublishPanel({
  token,
  eventId,
  publishable,
  hasDraft,
  latest,
}: {
  token: string;
  eventId: string;
  publishable: boolean;
  hasDraft: boolean;
  latest: Version | null;
}) {
  const [prior, setPrior] = useState<PriorShared | null>(null);
  const [version, setVersion] = useState<Version | null>(latest);
  const [justPublished, setJustPublished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultToken, setResultToken] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    setResultToken(readToken(eventId));
  }, [eventId]);

  const resultUrl = resultToken && origin ? `${origin}/r/${resultToken}` : null;
  const nextN = (version?.n ?? 0) + 1;

  async function publish() {
    if (!prior || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body: PublishRequest = { priorShared: prior };
      const res = await fetch(`/api/events/${eventId}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json", [ADMIN_HEADER]: token },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as PublishResponse | ApiError | null;
      if (!res.ok || !data || "error" in data) {
        setError(data && "error" in data ? data.error : "발행하지 못했어요. 잠시 뒤 다시 해 주세요.");
        return;
      }
      setVersion(data.version);
      setJustPublished(true);
      setCopied(false);
      setPrior(null);
    } catch {
      setError("인터넷 연결을 확인하고 다시 해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError("복사가 막혔어요. 아래 글을 길게 눌러 직접 복사해 주세요.");
    }
  }

  function applyLink() {
    const m = RESULT_TOKEN_RE.exec(linkInput.trim());
    if (!m) return setError("결과 링크(…/r/…)를 그대로 붙여 주세요.");
    setError(null);
    setResultToken(m[1]);
    saveToken(eventId, m[1]);
    setLinkInput("");
  }

  async function removeAll() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE", headers: { [ADMIN_HEADER]: token } });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        setError(data?.error ?? "지우지 못했어요. 잠시 뒤 다시 해 주세요.");
        return;
      }
      saveToken(eventId, null);
      setDeleted(true);
    } catch {
      setError("인터넷 연결을 확인하고 다시 해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (deleted) {
    return (
      <section className="blk stack">
        <p>
          <b>모두 지웠어요.</b>
        </p>
        <p className="note">붙여넣은 대화, 근거, 발행한 판, 결과 링크가 모두 지워졌어요. 결과 링크도 더 이상 열리지 않아요.</p>
        <Link className="btn wide" href="/">
          새 행사 만들기
        </Link>
      </section>
    );
  }

  const message = version ? fillMessage(version.message, resultUrl) : "";

  return (
    <>
      {error && (
        <div className="blk tip">
          <p className="alert" role="alert">
            {error}
          </p>
        </div>
      )}

      {/* 발행 */}
      {!hasDraft ? (
        <section className="blk stack">
          <p>
            <b>아직 정산표가 없어요.</b>
          </p>
          <p className="note">대화를 붙여넣고 검토를 마치면 여기서 발행할 수 있어요.</p>
          <Link className="btn wide" href={`/m/${token}/paste`}>
            대화 붙여넣기
          </Link>
        </section>
      ) : !publishable ? (
        <section className="blk stack">
          <p>
            <b>아직 발행할 수 없어요.</b>
          </p>
          <p className="note">
            <span className="mark">답하지 않은 질문이나 수동 정산이 필요한 항목</span>이 남아 있어요.
          </p>
          <Link className="btn wide" href={`/m/${token}`}>
            검토 화면으로
          </Link>
        </section>
      ) : (
        <section aria-labelledby="publish-next">
          <h2 className="blk sub" id="publish-next">
            {nextN}판 발행
          </h2>
          <fieldset className="blk stack">
            <legend className={s.legend}>이전에 정산을 공유하거나 이미 송금한 사람이 있나요?</legend>
            {PRIOR.map((p) => (
              <label key={p.value} className={prior === p.value ? "opt picked" : "opt"}>
                <input type="radio" name="prior" value={p.value} checked={prior === p.value} onChange={() => setPrior(p.value)} />
                <span>
                  <b>{p.label}</b>
                  <small>{p.hint}</small>
                </span>
              </label>
            ))}
            <button type="button" className="btn wide" onClick={publish} disabled={!prior || busy}>
              {busy ? "발행하는 중…" : prior ? `${nextN}판 발행하기` : "위에서 하나를 골라 주세요"}
            </button>
            {version && <p className="note">발행하면 결과 링크는 그대로이고, 모임원에게는 {nextN}판이 보여요.</p>}
          </fieldset>
        </section>
      )}

      {/* 발행된 판 */}
      {version && (
        <section aria-labelledby="publish-current">
          <div className={`blk ${s.current}`}>
            <div>
              <h2 className={s.h} id="publish-current" aria-live="polite">
                {justPublished ? `${version.n}판을 발행했어요` : `지금 공유 중: ${version.n}판`}
              </h2>
              <p className="note">{dateTime(version.publishedAt)}</p>
            </div>
            <Seal key={version.n} version={version.n} size={92} stamp={justPublished} />
          </div>

          {version.diff && version.diff.length > 0 && (
            <div className="tablewrap">
              <table className="ledger">
                <caption>{version.n - 1}판보다 바뀐 금액 · 단위 원</caption>
                <thead>
                  <tr>
                    <th scope="col">참여자</th>
                    <th scope="col">{version.n - 1}판</th>
                    <th scope="col">{version.n}판</th>
                    <th scope="col">변동</th>
                  </tr>
                </thead>
                <tbody>
                  {version.diff.map((d) => (
                    <tr key={d.alias}>
                      <th scope="row">{d.alias}</th>
                      <td>{signedNum(d.before)}</td>
                      <td>{signedNum(d.after)}</td>
                      <td className={d.delta > 0 ? "recv" : d.delta < 0 ? "send" : undefined}>{signedNum(d.delta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {version.transfers ? (
            <ul>
              {version.transfers.map((t, i) => (
                <li key={i} className="row split">
                  <span>
                    {t.from} → {t.to}
                  </span>
                  <b className="num">{won(t.amount)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <div className="blk tip">
              <p className="caution">
                {version.n === 1
                  ? "이미 공유했거나 잘 모른다고 해서, 송금안 대신 사람별 받을 돈·보낼 돈만 넣었어요."
                  : "이미 공유했거나 잘 모른다고 해서, 다시 송금하라는 안내 없이 바뀐 금액만 넣었어요."}
              </p>
            </div>
          )}

          <div className="blk stack">
            {!resultUrl && (
              <div className="caution">
                <p>
                  이 기기에서는 결과 링크를 찾지 못했어요. 행사를 만들 때 받은 <b>결과 링크</b>를 붙여 주세요.
                </p>
                <div className={s.linkRow}>
                  <input
                    className="input"
                    name="result-link"
                    aria-label="결과 링크"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    placeholder="https://…/r/…"
                    autoComplete="off"
                    inputMode="url"
                    spellCheck={false}
                  />
                  <button type="button" className="btn ghost" onClick={applyLink}>
                    넣기
                  </button>
                </div>
              </div>
            )}

            <label>
              <span className="label">단톡에 붙여 넣을 문구</span>
              <textarea
                className={`textarea ${s.message}`}
                name="message"
                value={message}
                readOnly
                rows={Math.min(14, message.split("\n").length + 3)}
              />
            </label>
            <button type="button" className="btn wide" onClick={() => copy(message)}>
              {copied ? "복사했어요" : "문구 복사"}
            </button>
            <span className="sr" role="status">
              {copied ? "문구를 복사했어요" : ""}
            </span>
            {resultUrl && (
              <a className={s.resultLink} href={resultUrl} target="_blank" rel="noreferrer">
                결과 페이지 열어 보기<span className="sr"> (새 창)</span>
              </a>
            )}
          </div>
        </section>
      )}

      {/* 모두 지우기 */}
      <section className={`blk ${s.danger}`}>
        {!confirmDelete ? (
          <button type="button" className="textbtn danger" onClick={() => setConfirmDelete(true)}>
            모두 지우기
          </button>
        ) : (
          <div className="alert" role="group" aria-label="모두 지우기 확인">
            <p>
              <b>정말 지울까요?</b> 붙여넣은 대화, 근거, 발행한 판, 결과 링크가 바로 지워지고 되돌릴 수 없어요.
            </p>
            <div className={s.confirmRow}>
              <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
                취소
              </button>
              <button type="button" className="btn danger" onClick={removeAll} disabled={busy}>
                {busy ? "지우는 중…" : "모두 지우기"}
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
