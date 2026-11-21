/**
 * S4 정산표 본문 — 담당: C
 * 사람별 순결제액·부담·잔액, 항목별 근거(원 발언·정정 발언·총무 확인값), 송금안, 검산.
 * 서버에서 그린다. 펼치기는 <details>라 자바스크립트 없이 동작한다.
 */
import type { Draft, Item, LineNo, MaskedLine, PersonResult } from "@/lib/types";
import { signedWon, won } from "./format";

const STATUS_LABEL: Record<Item["status"], string> = {
  candidate: "확정 후보",
  needs_check: "확인 필요",
  manual: "직접 입력",
};

const QUESTION_KIND: Record<string, string> = {
  target: "어느 결제",
  split: "금액 나누기",
  refund: "환불",
  duplicate: "중복",
};

/** 정리기가 남긴 확인 표시(Q-{kind}-{줄}, manual) → 화면 문구. 직접 입력은 따로 표시하므로 null */
function confirmationLabel(c: string): string | null {
  if (c === "manual") return null;
  const m = /^Q-([a-z]+)-(.+)$/.exec(c);
  if (m) return `총무가 답한 질문: ${QUESTION_KIND[m[1]] ?? m[1]} (${m[2]}줄)`;
  return `총무 확인 (${c})`;
}

const OUT_OF_SCOPE_LABEL: Record<string, string> = {
  foreign_currency: "외화",
  prepaid: "선입금",
  partial_refund: "부분 환불",
  joint_payment: "공동 결제",
  other: "자동 계산 범위 밖",
};

/** 항목 하나의 근거: 원 발언·정정 발언 줄과 총무 확인값 */
function ItemEvidence({ item, lines }: { item: Item; lines: Map<LineNo, MaskedLine> }) {
  return (
    <div className="evidence">
      <dl className="facts">
        <dt>결제</dt>
        <dd>{item.payer}</dd>
        <dt>나눈 사람</dt>
        <dd>
          {item.split.join(" · ")} ({item.split.length}명)
        </dd>
        {item.grossAmount !== item.amount && (
          <>
            <dt>결제액</dt>
            <dd>
              {won(item.grossAmount)} → 환불 반영 {won(item.amount)}
            </dd>
          </>
        )}
      </dl>
      {item.evidence.length > 0 ? (
        <ol className="quotes">
          {item.evidence.map((no, i) => {
            const l = lines.get(no);
            const kind = item.status === "manual" ? "근거" : i === 0 ? "원 발언" : "정정 발언";
            return (
              <li key={no}>
                <span className={`kind ${i === 0 ? "first" : "later"}`}>{kind}</span>
                <span className="no">{no}</span>
                <span className="who">{l?.speaker ?? "화자 미지정"}</span>
                <span className="said">{l ? l.text : "(원문 줄을 찾을 수 없음)"}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="muted">근거 줄 없음</p>
      )}
      {item.confirmations.some((c) => confirmationLabel(c)) && (
        <ul className="confirms">
          {item.confirmations.map((c) => {
            const t = confirmationLabel(c);
            return t ? <li key={c}>✔ {t}</li> : null;
          })}
        </ul>
      )}
      {item.status === "manual" && <p className="muted">총무가 직접 넣은 항목 · 확인자: 총무</p>}
    </div>
  );
}

function PersonCard({ person, items, lines }: { person: PersonResult; items: Item[]; lines: Map<LineNo, MaskedLine> }) {
  const tone = person.balance > 0 ? "plus" : person.balance < 0 ? "minus" : "zero";
  const owed = items.filter((it) => (person.shares[it.id] ?? 0) > 0 || it.split.includes(person.alias));
  return (
    <details className={`person tone-${tone}`}>
      <summary>
        <span className="alias">{person.alias}</span>
        <span className="balance">
          {signedWon(person.balance)}
          <small>{person.balance > 0 ? "받을 돈" : person.balance < 0 ? "보낼 돈" : "정산 끝"}</small>
        </span>
      </summary>
      <dl className="facts">
        <dt>순결제액</dt>
        <dd>{won(person.paid)}</dd>
        <dt>총부담</dt>
        <dd>{won(person.total)}</dd>
      </dl>
      <ul className="shares">
        {owed.map((it) => {
          const share = person.shares[it.id] ?? 0;
          const extra = person.remainderFrom.includes(it.id);
          return (
            <li key={it.id}>
              <details>
                <summary>
                  <span>{it.name}</span>
                  <span className="amt">
                    {won(share)}
                    {extra && <em className="tag">나머지 1원</em>}
                  </span>
                </summary>
                <p className="why">
                  {it.amount === 0
                    ? `${won(it.grossAmount)} 전액 환불돼 부담 없음`
                    : `${won(it.amount)} ÷ ${it.split.length}명${extra ? " · 나누어떨어지지 않은 1원을 명단 순서로 받음" : ""}`}
                </p>
                <ItemEvidence item={it} lines={lines} />
              </details>
            </li>
          );
        })}
        {owed.length === 0 && <li className="muted">나눠 낼 항목 없음</li>}
      </ul>
    </details>
  );
}

export function SettlementView({ draft }: { draft: Draft }) {
  const { resolution, settlement } = draft;
  const lines = new Map(draft.lines.map((l) => [l.no, l]));
  const failedChecks = settlement?.checks.filter((c) => !c.ok) ?? [];
  const outOfScope = resolution.blockers.filter((b) => b.reason in OUT_OF_SCOPE_LABEL);
  const invalid = resolution.blockers.filter((b) => b.reason === "invalid_item");

  return (
    <>
      {draft.aiDraft && <p className="badge ai">AI 추출 초안 · 총무 확인 후 발행</p>}

      {!draft.publishable && (
        <section className="notice warn" aria-live="polite">
          <strong>아직 발행할 수 없어요</strong>
          <ul>
            {resolution.questions.length > 0 && <li>답하지 않은 질문 {resolution.questions.length}건 (검토 화면)</li>}
            {outOfScope.length > 0 && (
              <li>
                수동 정산이 필요한 줄:{" "}
                {outOfScope.map((b) => `${b.line}줄(${OUT_OF_SCOPE_LABEL[b.reason] ?? b.reason})`).join(", ")}
              </li>
            )}
            {invalid.length > 0 && (
              <li>
                정보가 부족한 항목: {invalid.map((b) => (b.line ? `${b.line}줄` : "직접 입력")).join(", ")} (검토 화면)
              </li>
            )}
            {failedChecks.map((c) => (
              <li key={c.name}>검산 실패: {c.name}</li>
            ))}
          </ul>
        </section>
      )}

      {!settlement ? (
        <section className="notice">
          <strong>아직 정산할 항목이 없어요</strong>
          <p>검토 화면에서 항목을 확인하거나 직접 추가해 주세요.</p>
        </section>
      ) : (
        <>
          <section>
            <h2>사람별</h2>
            <table className="summary">
              <thead>
                <tr>
                  <th scope="col">참여자</th>
                  <th scope="col">순결제액</th>
                  <th scope="col">총부담</th>
                  <th scope="col">잔액</th>
                </tr>
              </thead>
              <tbody>
                {settlement.people.map((p) => (
                  <tr key={p.alias}>
                    <th scope="row">{p.alias}</th>
                    <td>{won(p.paid)}</td>
                    <td>{won(p.total)}</td>
                    <td className={p.balance > 0 ? "plus" : p.balance < 0 ? "minus" : ""}>{signedWon(p.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint">이름을 누르면 항목별 몫과 그 이유가 나와요.</p>
            <div className="people">
              {settlement.people.map((p) => (
                <PersonCard key={p.alias} person={p} items={resolution.items} lines={lines} />
              ))}
            </div>
          </section>

          <section>
            <h2>항목</h2>
            <div className="items">
              {resolution.items.map((it) => (
                <details key={it.id} className="item" id={`item-${it.id}`}>
                  <summary>
                    <span className="name">
                      {it.name} <small className={`status ${it.status}`}>{STATUS_LABEL[it.status]}</small>
                    </span>
                    <span className="amt">
                      {it.amount !== it.grossAmount && <s>{won(it.grossAmount)}</s>} {won(it.amount)}
                    </span>
                  </summary>
                  <ItemEvidence item={it} lines={lines} />
                </details>
              ))}
            </div>
          </section>

          <section>
            <h2>송금안</h2>
            {settlement.transfers.length > 0 ? (
              <ol className="transfers">
                {settlement.transfers.map((t, i) => (
                  <li key={i}>
                    <span>
                      {t.from} → {t.to}
                    </span>
                    <strong>{won(t.amount)}</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">주고받을 돈이 없어요.</p>
            )}
          </section>

          <details className="checks">
            <summary>
              검산 {settlement.checks.filter((c) => c.ok).length}/{settlement.checks.length} 통과
            </summary>
            <ul>
              {settlement.checks.map((c) => (
                <li key={c.name} className={c.ok ? "ok" : "fail"}>
                  {c.ok ? "✔" : "✘"} {c.name}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </>
  );
}
