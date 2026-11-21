/**
 * S4 정산표 본문 — 담당: C
 * 사람별 순결제액·부담·잔액, 항목별 근거(원 발언·정정 발언·총무 확인값), 송금안, 검산.
 * 서버에서 그린다. 펼치기는 <details>라 자바스크립트 없이 동작한다.
 *
 * 여백의 번호: 한 자리는 명단 순서(나머지 1원이 붙는 순서), 두 자리는 근거가 된 대화의 줄 번호.
 */
import type { Draft, Item, LineNo, MaskedLine, PersonResult } from "@/lib/types";
import { num, signedNum, signedWon, won } from "./format";
import { IconCheck, IconChevron, IconCross } from "./icons";
import { OpenDetailsOnHash } from "./OpenDetailsOnHash";

const STATUS_LABEL: Record<Item["status"], string> = {
  candidate: "확정 후보",
  needs_check: "확인 필요",
  manual: "직접 입력",
};
/** 항목 상태를 필기구로: 연필 = AI 초안, 형광펜 = 확인 필요, 파랑 펜 = 총무가 넣음 */
const STATUS_CLASS: Record<Item["status"], string> = {
  candidate: "pencil",
  needs_check: "mark",
  manual: "pen",
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

/** 근거가 된 발언 한 줄. 줄 번호는 여백에 적는다 */
function Quote({ no, kind, later, lines }: { no: LineNo; kind: string; later?: boolean; lines: Map<LineNo, MaskedLine> }) {
  const l = lines.get(no);
  return (
    <li className="row">
      <span className="no">{no}</span>
      <span className={later ? "kind later" : "kind"}>
        {kind} · {l?.speaker ?? "화자 미지정"}
      </span>
      {l ? l.text : "(원문 줄을 찾을 수 없음)"}
    </li>
  );
}

/** 항목 하나의 근거: 원 발언·정정 발언 줄과 총무 확인값 */
function ItemEvidence({ item, lines }: { item: Item; lines: Map<LineNo, MaskedLine> }) {
  const confirms = item.confirmations.map((c) => confirmationLabel(c)).filter((t): t is string => !!t);
  return (
    <>
      <dl className="blk facts">
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
              {won(item.grossAmount)}, 환불 반영 {won(item.amount)}
            </dd>
          </>
        )}
      </dl>
      {item.evidence.length > 0 ? (
        <ol>
          {item.evidence.map((no, i) => (
            <Quote
              key={no}
              no={no}
              kind={item.status === "manual" ? "근거" : i === 0 ? "원 발언" : "정정 발언"}
              later={item.status !== "manual" && i > 0}
              lines={lines}
            />
          ))}
        </ol>
      ) : (
        <p className="blk note tip">근거 줄 없음</p>
      )}
      {confirms.length > 0 && (
        <ul>
          {confirms.map((t) => (
            <li key={t} className="row pen">
              <IconCheck />
              {t}
            </li>
          ))}
        </ul>
      )}
      {item.status === "manual" && <p className="blk note tip">총무가 직접 넣은 항목 · 확인자: 총무</p>}
    </>
  );
}

function PersonCard({
  person,
  order,
  items,
  lines,
  anchor,
}: {
  person: PersonResult;
  /** 명단 순서 (1부터) */
  order: number;
  items: Item[];
  lines: Map<LineNo, MaskedLine>;
  anchor: string;
}) {
  const tone = person.balance > 0 ? "recv" : person.balance < 0 ? "send" : "";
  const owed = items.filter((it) => (person.shares[it.id] ?? 0) > 0 || it.split.includes(person.alias));

  // 그 금액의 이유 (발표 12쪽: 항목·참여자·원 발언·정정 발언·총무 확인값 순서)
  const paidFor = owed.filter((it) => (person.shares[it.id] ?? 0) > 0);
  const quoted = paidFor.filter((it) => it.status !== "manual");
  const confirmed = [
    ...new Set(
      paidFor.flatMap((it) => [
        ...it.confirmations.map((c) => confirmationLabel(c)).filter((t): t is string => !!t),
        ...(it.status === "manual" ? [`직접 입력: ${it.name}`] : []),
      ]),
    ),
  ];

  return (
    <details className="person" id={anchor}>
      <summary className="row fold">
        <span className="no">{order}</span>
        <span className="lead">
          <b>{person.alias}</b>
          <span className="note num">총부담 {won(person.total)}</span>
        </span>
        <span className="trail">
          <b className={`num ${tone}`}>{signedWon(person.balance)}</b>
          <span className="note">{person.balance > 0 ? "받을 돈" : person.balance < 0 ? "보낼 돈" : "정산 끝"}</span>
        </span>
        <IconChevron className="chev" />
      </summary>
      <div className="inner">
        <dl className="blk facts">
          <dt>순결제액</dt>
          <dd>{won(person.paid)}</dd>
          <dt>총부담</dt>
          <dd>{won(person.total)}</dd>
        </dl>
        <ul>
          {owed.map((it) => {
            const share = person.shares[it.id] ?? 0;
            const extra = person.remainderFrom.includes(it.id);
            return (
              <li key={it.id} className="row">
                <div className="split">
                  <span>{it.name}</span>
                  <span className="num">
                    {won(share)}
                    {extra && <em className="tag">나머지 1원</em>}
                  </span>
                </div>
                <p className="note">
                  {it.amount === 0
                    ? `${won(it.grossAmount)} 전액 환불돼 부담 없음`
                    : `${won(it.amount)} ÷ ${it.split.length}명${extra ? " · 나누어떨어지지 않은 1원을 명단 순서로 받음" : ""}`}
                  {" · "}
                  <a className="cite" href={`#item-${it.id}`}>
                    {it.evidence.length > 0 ? `근거 ${it.evidence.join("·")}줄` : "근거 보기"}
                  </a>
                </p>
              </li>
            );
          })}
          {owed.length === 0 && <li className="row note">나눠 낼 항목 없음</li>}
        </ul>
        {quoted.length > 0 && (
          <ol>
            {quoted
              .filter((it) => it.evidence[0])
              .map((it) => (
                <Quote key={`o${it.id}`} no={it.evidence[0]} kind={`원 발언 · ${it.name}`} lines={lines} />
              ))}
            {quoted.flatMap((it) =>
              it.evidence.slice(1).map((no) => <Quote key={`c${it.id}${no}`} no={no} kind={`정정 발언 · ${it.name}`} later lines={lines} />),
            )}
          </ol>
        )}
        {confirmed.length > 0 && (
          <ul>
            {confirmed.map((t) => (
              <li key={t} className="row pen">
                <IconCheck />
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
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
      {(draft.aiDraft || !draft.publishable) && (
        <div className="blk status" aria-live="polite">
          {draft.aiDraft && (
            <p className="note">
              <span className="pencil">AI 추출 초안</span> · 총무 확인 후 발행
            </p>
          )}
          {!draft.publishable && (
            <>
              <p>
                <b>아직 발행할 수 없어요.</b>
              </p>
              <ul className="todo">
                {resolution.questions.length > 0 && (
                  <li>
                    <span className="mark">답하지 않은 질문 {resolution.questions.length}건</span> (검토 화면)
                  </li>
                )}
                {outOfScope.length > 0 && (
                  <li>
                    <span className="mark">수동 정산이 필요한 줄</span>:{" "}
                    {outOfScope.map((b) => `${b.line}줄(${OUT_OF_SCOPE_LABEL[b.reason] ?? b.reason})`).join(", ")}
                  </li>
                )}
                {invalid.length > 0 && (
                  <li>
                    <span className="mark">정보가 부족한 항목</span>:{" "}
                    {invalid.map((b) => (b.line ? `${b.line}줄` : "직접 입력")).join(", ")} (검토 화면)
                  </li>
                )}
                {failedChecks.map((c) => (
                  <li key={c.name} className="send">
                    검산 실패: {c.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {!settlement ? (
        <div className="blk status">
          <p>
            <b>아직 정산할 항목이 없어요.</b>
          </p>
          <p className="note">검토 화면에서 항목을 확인하거나 직접 추가해 주세요.</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="table-people">
            <h2 className="blk sub" id="table-people">
              사람별<span className="unit">단위 원</span>
            </h2>
            <div className="tablewrap">
              <table className="ledger">
                <thead>
                  <tr>
                    <th scope="col">참여자</th>
                    <th scope="col">순결제액</th>
                    <th scope="col">총부담</th>
                    <th scope="col">잔액</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.people.map((p, i) => (
                    <tr key={p.alias}>
                      <th scope="row">
                        <a href={`#person-${i}`}>{p.alias}</a>
                      </th>
                      <td>{num(p.paid)}</td>
                      <td>
                        <a href={`#person-${i}`} className="amount-link" aria-label={`${p.alias} 총부담 ${won(p.total)}의 이유 보기`}>
                          {num(p.total)}
                        </a>
                      </td>
                      <td className={p.balance > 0 ? "recv" : p.balance < 0 ? "send" : ""}>{signedNum(p.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="blk note tip">이름이나 총부담 금액을 누르면 그 금액의 이유가 나와요. 잔액이 +면 받을 돈, −면 보낼 돈이에요.</p>
            <OpenDetailsOnHash />
            {settlement.people.map((p, i) => (
              <PersonCard key={p.alias} person={p} order={i + 1} items={resolution.items} lines={lines} anchor={`person-${i}`} />
            ))}
          </section>

          <section aria-labelledby="table-items">
            <h2 className="blk sub" id="table-items">
              항목
            </h2>
            {resolution.items.map((it) => (
              <details key={it.id} className="item" id={`item-${it.id}`}>
                <summary className="row fold">
                  <span className="lead">
                    <b>{it.name}</b>
                    <span className="note">
                      <span className={STATUS_CLASS[it.status]}>{STATUS_LABEL[it.status]}</span> · {it.payer} 결제
                    </span>
                  </span>
                  <span className="trail">
                    <b className="num">
                      {it.amount !== it.grossAmount && <s>{won(it.grossAmount)}</s>} {won(it.amount)}
                    </b>
                  </span>
                  <IconChevron className="chev" />
                </summary>
                <div className="inner">
                  <ItemEvidence item={it} lines={lines} />
                </div>
              </details>
            ))}
          </section>

          <section aria-labelledby="table-transfers">
            <h2 className="blk sub" id="table-transfers">
              송금안
            </h2>
            {settlement.transfers.length > 0 ? (
              <ol>
                {settlement.transfers.map((t, i) => (
                  <li key={i} className="row split">
                    <span>
                      {t.from} → {t.to}
                    </span>
                    <b className="num">{won(t.amount)}</b>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="blk note tip">주고받을 돈이 없어요.</p>
            )}
          </section>

          <section aria-labelledby="table-checks">
            <h2 className="blk sub" id="table-checks">
              검산
            </h2>
            <details className="checks">
              <summary className="row fold">
                <span className={failedChecks.length > 0 ? "send" : "pen"}>
                  {failedChecks.length > 0 ? <IconCross /> : <IconCheck />}
                  {settlement.checks.filter((c) => c.ok).length}/{settlement.checks.length} 통과
                </span>
                <IconChevron className="chev" />
              </summary>
              <ul className="inner">
                {settlement.checks.map((c) => (
                  <li key={c.name} className={`row check ${c.ok ? "ok" : "fail"}`}>
                    {c.ok ? <IconCheck /> : <IconCross />}
                    {c.name}
                    <span className="sr">{c.ok ? " 통과" : " 실패"}</span>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        </>
      )}
    </>
  );
}
