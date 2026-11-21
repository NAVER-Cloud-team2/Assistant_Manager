"use client";

/**
 * S2 붙여넣기 — 담당: C (구현계획서 3장 S2)
 * 고지·동의 → 원문 붙여넣기 → 화자를 별칭에 연결 → 가림 미리보기·사적 발언 빼기 → 가린 줄만 전송
 *
 * 규칙: 원문(raw)은 이 컴포넌트의 메모리에만 있다. 서버로 가는 것은 maskMessages 결과뿐이다.
 */
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ADMIN_HEADER, type ApiError, type ExcerptRequest } from "@/lib/api";
import { maskMessages, parseMessages, suggestSpeakerMap } from "@/lib/mask";
import type { Alias, MaskedLine } from "@/lib/types";
import s from "./PasteFlow.module.css";

/** 한 번에 보낼 수 있는 발언 수 — D의 app/api/_lib/validate.ts LIMITS.linesMax와 같은 값 */
export const MAX_LINES = 300;
/** 한 줄 최대 글자 수 — D의 LIMITS.lineTextMax와 같은 값. 넘으면 서버가 거절하므로 보내기 전에 알린다 */
export const MAX_LINE_TEXT = 1000;

/**
 * 사전 고지 문구 (문제정의서: 붙여넣기 전에 AI 제공사와 국외 이전 여부를 알리고 동의를 받는다).
 * AI 제공사는 팀장 결정으로 CLOVA Studio에서 OpenAI로 바뀌었다(B의 lib/extract.ts, AI_PROVIDER로 Gemini 선택 가능).
 * 두 곳 모두 해외 서비스라 국외 이전을 알린다. 제공사 이름은 서버(paste/page.tsx)가 넘긴다.
 * TODO(C): 입력의 학습 사용 여부·제공사 보관 기간은 B가 해당 API 정책을 확인하면 한 줄 추가한다.
 */
function notice(aiProvider: string): string[] {
  return [
    "이름은 별칭으로, 전화·계좌번호는 [전화번호]·[계좌번호]로 이 휴대폰에서 바꾼 뒤 보내요. 실명이 담긴 원문은 서버로 가지 않아요.",
    `가린 대화는 해외 AI 서비스(${aiProvider})로 전송돼 결제·정정·환불 후보를 찾는 데 쓰여요. 국외로 전송되는 것이에요.`,
    "가린 대화와 근거는 마지막 수정 후 7일, 결과 링크는 확정 후 30일이 지나면 자동으로 지워져요. ‘모두 지우기’로 바로 지울 수도 있어요.",
  ];
}

const NONE = "";

export function PasteFlow({
  token,
  eventId,
  roster,
  hasDraft,
  aiProvider,
}: {
  token: string;
  eventId: string;
  roster: Alias[];
  hasDraft: boolean;
  /** 화면에 보일 AI 제공사 이름 (예: "OpenAI") */
  aiProvider: string;
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [raw, setRaw] = useState("");
  /** 화자 이름 → 별칭 ("" = 연결 안 함) */
  const [speakerMap, setSpeakerMap] = useState<Record<string, Alias>>({});
  /** 형식을 못 읽었을 때 줄마다 고른 별칭 */
  const [lineSpeaker, setLineSpeaker] = useState<Record<number, Alias>>({});
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parseMessages(raw), [raw]);
  const speakers = useMemo(() => {
    const seen: string[] = [];
    for (const m of parsed.messages) if (m.speaker && !seen.includes(m.speaker)) seen.push(m.speaker);
    return seen;
  }, [parsed]);

  const cleanMap = useMemo(() => {
    const m: Record<string, Alias> = {};
    for (const [k, v] of Object.entries(speakerMap)) if (v && speakers.includes(k)) m[k] = v;
    return m;
  }, [speakerMap, speakers]);
  const unmapped = speakers.filter((sp) => !cleanMap[sp]);

  /** 미리보기용: 원래 발언 순서마다 가린 결과 (빼기 전) */
  const preview: MaskedLine[] = useMemo(() => {
    const lines = maskMessages(parsed.messages, cleanMap);
    if (!parsed.recognized) return lines.map((l, i) => ({ ...l, speaker: lineSpeaker[i] || null }));
    return lines;
  }, [parsed, cleanMap, lineSpeaker]);

  /** 실제로 보낼 줄: 뺀 발언을 제외하고 01부터 다시 번호 */
  const outgoing: MaskedLine[] = useMemo(
    () =>
      preview
        .filter((_, i) => !excluded.has(i))
        .map((l, i) => ({ ...l, no: String(i + 1).padStart(2, "0") })),
    [preview, excluded],
  );
  const noSpeaker = outgoing.filter((l) => !l.speaker).length;

  function onPaste(text: string) {
    setRaw(text);
    setExcluded(new Set());
    setLineSpeaker({});
    setError(null);
    const p = parseMessages(text);
    const sp = [...new Set(p.messages.map((m) => m.speaker).filter((x): x is string => !!x))];
    setSpeakerMap(suggestSpeakerMap(sp, roster));
  }

  function toggleExclude(i: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function send() {
    if (busy || outgoing.length === 0) return;
    if (outgoing.length > MAX_LINES) {
      setError(`한 번에 ${MAX_LINES}줄까지 보낼 수 있어요. 정산과 관련 없는 줄을 빼 주세요.`);
      return;
    }
    const tooLong = outgoing.find((l) => l.text.length > MAX_LINE_TEXT);
    if (tooLong) {
      setError(`${tooLong.no}번 줄이 너무 길어요. 한 줄은 ${MAX_LINE_TEXT.toLocaleString("ko-KR")}자까지 보낼 수 있어요. 줄을 빼거나 정산과 관련된 부분만 남겨 주세요.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: ExcerptRequest = { lines: outgoing };
      const res = await fetch(`/api/events/${eventId}/excerpt`, {
        method: "POST",
        headers: { "content-type": "application/json", [ADMIN_HEADER]: token },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        setError(data?.error ?? "보내지 못했어요. 잠시 뒤 다시 해 주세요.");
        return;
      }
      setRaw(""); // 원문은 더 들고 있지 않는다
      router.push(`/m/${token}`);
    } catch {
      setError("인터넷 연결을 확인하고 다시 해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.flow}>
      {/* 1. 고지·동의 */}
      <section className={s.card}>
        <h2>보내기 전에 확인해 주세요</h2>
        <ul className={s.notice}>
          {notice(aiProvider).map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <label className={s.check}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>모임원에게 허락받은 정산 대화만 붙여넣고, 가린 대화가 국외 AI 서비스로 전송되는 것을 포함해 위 내용에 동의해요.</span>
        </label>
      </section>

      {agreed && (
        <>
          {/* 2. 붙여넣기 */}
          <section className={s.card}>
            <h2>대화 붙여넣기</h2>
            <p className={s.hint}>카카오톡에서 정산 이야기가 나온 부분만 길게 눌러 복사해 붙여넣어 주세요.</p>
            <textarea
              className={s.raw}
              value={raw}
              onChange={(e) => onPaste(e.target.value)}
              placeholder={"[김가람] [오후 9:12] 저녁 52,001원 내가 냈어\n[이보람] [오후 11:40] 2차는 내가 냈어"}
              rows={8}
              spellCheck={false}
              autoComplete="off"
            />
            {raw && (
              <p className={s.hint}>
                {parsed.recognized
                  ? `발언 ${parsed.messages.length}개, 말한 사람 ${speakers.length}명을 찾았어요.`
                  : "카카오톡 형식을 읽지 못했어요. 아래에서 줄마다 말한 사람을 골라 주세요."}
              </p>
            )}
          </section>

          {/* 3. 화자 연결 */}
          {parsed.recognized && speakers.length > 0 && (
            <section className={s.card}>
              <h2>말한 사람 연결</h2>
              <p className={s.hint}>대화 속 이름을 명단의 별칭에 연결하면, 본문에 나온 이름도 별칭으로 바뀌어요.</p>
              <ul className={s.map}>
                {speakers.map((sp) => (
                  <li key={sp}>
                    <span className={s.realName}>{sp}</span>
                    <span aria-hidden>→</span>
                    <select
                      value={speakerMap[sp] ?? NONE}
                      onChange={(e) => setSpeakerMap((m) => ({ ...m, [sp]: e.target.value }))}
                      aria-label={`${sp}의 별칭`}
                    >
                      <option value={NONE}>연결 안 함</option>
                      {roster.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
              {unmapped.length > 0 && (
                <p className={s.warn}>
                  연결 안 된 사람 {unmapped.length}명: 발언은 ‘말한 사람 없음’으로 보내고, 본문의 그 이름은 [이름]으로 가려요.
                </p>
              )}
            </section>
          )}

          {/* 4. 미리보기 */}
          {preview.length > 0 && (
            <section className={s.card}>
              <h2>서버로 보낼 내용</h2>
              <p className={s.hint}>
                정산과 관련 없는 사적인 줄은 ‘빼기’를 눌러 주세요. 이름이 덜 가려진 곳이 없는지도 확인해 주세요.
              </p>
              <ol className={s.preview}>
                {preview.map((l, i) => {
                  const out = excluded.has(i);
                  return (
                    <li key={i} className={out ? s.out : undefined}>
                      <div className={s.lineHead}>
                        {parsed.recognized ? (
                          <span className={s.who}>{l.speaker ?? "말한 사람 없음"}</span>
                        ) : (
                          <select
                            value={lineSpeaker[i] ?? NONE}
                            onChange={(e) => setLineSpeaker((m) => ({ ...m, [i]: e.target.value }))}
                            aria-label={`${i + 1}번째 줄 말한 사람`}
                          >
                            <option value={NONE}>말한 사람?</option>
                            {roster.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                          </select>
                        )}
                        <button type="button" className={s.toggle} onClick={() => toggleExclude(i)} aria-pressed={out}>
                          {out ? "되살리기" : "빼기"}
                        </button>
                      </div>
                      <p className={s.text}>{l.text}</p>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {/* 5. 보내기 */}
          {preview.length > 0 && (
            <section className={s.sendBox}>
              {hasDraft && (
                <p className={s.warn}>이미 보낸 대화가 있어요. 다시 보내면 이전 대화와 검토 화면에서 한 답이 새 내용으로 바뀌어요.</p>
              )}
              {noSpeaker > 0 && <p className={s.warn}>말한 사람이 없는 줄이 {noSpeaker}개 있어요. 결제자를 알기 어려울 수 있어요.</p>}
              {error && (
                <p className={s.error} role="alert">
                  {error}
                </p>
              )}
              <button type="button" className={s.primary} onClick={send} disabled={busy || outgoing.length === 0}>
                {busy ? "보내는 중… (AI 분석까지 최대 10초)" : `가린 ${outgoing.length}줄 보내기`}
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
