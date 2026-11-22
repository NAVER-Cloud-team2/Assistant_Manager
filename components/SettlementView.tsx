/**
 * S4 정산 — 담당: C
 * 맨 위 지갑 카드(나눌 금액), 사람별 받을 돈·보낼 돈, 항목, 송금안, 검산.
 * 사람이나 항목을 누르면 아래에서 시트가 올라와 그 금액의 이유(항목·원 발언·정정 발언·총무 확인값)를 보여 준다.
 * 내용은 서버에서 그리고, 시트를 여닫는 단추만 브라우저에서 움직인다 (주소의 #person-N, #item-ID로 바로 열 수 있다).
 *
 * 왼쪽 번호: 한 자리는 명단 순서(나머지 1원이 붙는 순서), 두 자리는 근거가 된 대화의 줄 번호.
 */
import type { Draft, Item, LineNo, MaskedLine, PersonResult } from "@/lib/types";
import { signedWon, won } from "./format";
import { IconCheck, IconCheckCircle, IconChevron, IconCross, IconSparkle, IconWarn } from "./icons";
import s from "./SettlementView.module.css";
import { SheetButton } from "./Sheet";

const STATUS_LABEL: Record<Item["status"], string> = {
  candidate: "확정 후보",
  needs_check: "확인 필요",
  manual: "직접 입력",
};
/** 항목 상태 표시: 반짝이 = AI 초안, 주황 = 확인 필요, 초록 = 총무가 넣음 */
const STATUS_CHIP: Record<Item["status"], string> = {
  candidate: "chip",
  needs_check: "chip warn",
  manual: "chip ok",
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

/** 근거가 된 발언 한 줄. 줄 번호는 왼쪽에 적는다 */
function Quote({ no, kind, later, lines }: { no: LineNo; kind: string; later?: boolean; lines: Map<LineNo, MaskedLine> }) {
  const l = lines.get(no);
  return (
    <li className={`cell ${s.quote}`}>
      <span className={s.no}>{no}</span>
      <span className="cell-main">
        <span className={later ? `${s.kind} ${s.later}` : s.kind}>
          {kind} · {l?.speaker ?? "화자 미지정"}
        </span>
        <span>{l ? l.text : "(원문 줄을 찾을 수 없음)"}</span>
      </span>
    </li>
  );
}

function Confirmed({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <div className="section">
      <h3 className="section-header">총무 확인</h3>
      <ul className="group">
        {labels.map((t) => (
          <li key={t} className={`cell ${s.confirmed}`}>
            <IconCheckCircle />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 항목 하나의 근거: 원 발언·정정 발언 줄과 총무 확인값 */
function ItemEvidence({ item, lines }: { item: Item; lines: Map<LineNo, MaskedLine> }) {
  const confirms = item.confirmations.map((c) => confirmationLabel(c)).filter((t): t is string => !!t);
  return (
    <>
      <div className="section">
        <div className="group">
          <div className="cell">
            <span className="cell-main">결제</span>
            <span className="muted">{item.payer}</span>
          </div>
          <div className="cell">
            <span className="cell-main">나눈 사람</span>
            <span className={`muted ${s.right}`}>
              {item.split.join(" · ")} ({item.split.length}명)
            </span>
          </div>
          {item.grossAmount !== item.amount && (
            <div className="cell">
              <span className="cell-main">결제액</span>
              <span className={`muted num ${s.right}`}>
                {won(item.grossAmount)}, 환불 반영 {won(item.amount)}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="section">
        <h3 className="section-header">근거가 된 말</h3>
        {item.evidence.length > 0 ? (
          <ol className={`group ${s.quotes}`}>
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
          <p className="section-footer">근거 줄 없음</p>
        )}
      </div>
      <Confirmed labels={confirms} />
      {item.status === "manual" && <p className="section-footer">총무가 직접 넣은 항목 · 확인자: 총무</p>}
    </>
  );
}

/** 사람 한 명의 그 금액의 이유 (발표 12쪽: 항목·참여자·원 발언·정정 발언·총무 확인값 순서) */
function PersonDetail({ person, items, lines }: { person: PersonResult; items: Item[]; lines: Map<LineNo, MaskedLine> }) {
  const owed = items.filter((it) => (person.shares[it.id] ?? 0) > 0 || it.split.includes(person.alias));
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
    <>
      <div className="section">
        <div className="group">
          <div className="cell">
            <span className="cell-main">순결제액</span>
            <span className="muted num">{won(person.paid)}</span>
          </div>
          <div className="cell">
            <span className="cell-main">총부담</span>
            <span className="num">
              <b>{won(person.total)}</b>
            </span>
          </div>
        </div>
      </div>
      <div className="section">
        <h3 className="section-header">항목별 부담</h3>
        <ul className="group">
          {owed.map((it) => {
            const share = person.shares[it.id] ?? 0;
            const extra = person.remainderFrom.includes(it.id);
            return (
              <li key={it.id} className="cell">
                <span className="cell-main">
                  <span className="cell-title">{it.name}</span>
                  <span className="cell-sub">
                    {it.amount === 0
                      ? `${won(it.grossAmount)} 전액 환불돼 부담 없음`
                      : `${won(it.amount)} ÷ ${it.split.length}명${extra ? " · 나누어떨어지지 않은 1원을 명단 순서로 받음" : ""}`}
                    {it.evidence.length > 0 && ` · 근거 ${it.evidence.join("·")}줄`}
                  </span>
                </span>
                <span className="cell-end">
                  <span className="num">{won(share)}</span>
                  {extra && <span className="chip blue">나머지 1원</span>}
                </span>
              </li>
            );
          })}
          {owed.length === 0 && <li className="cell muted">나눠 낼 항목 없음</li>}
        </ul>
      </div>
      {quoted.length > 0 && (
        <div className="section">
          <h3 className="section-header">근거가 된 말</h3>
          <ol className={`group ${s.quotes}`}>
            {quoted
              .filter((it) => it.evidence[0])
              .map((it) => (
                <Quote key={`o${it.id}`} no={it.evidence[0]} kind={`원 발언 · ${it.name}`} lines={lines} />
              ))}
            {quoted.flatMap((it) =>
              it.evidence.slice(1).map((no) => <Quote key={`c${it.id}${no}`} no={no} kind={`정정 발언 · ${it.name}`} later lines={lines} />),
            )}
          </ol>
        </div>
      )}
      <Confirmed labels={confirmed} />
    </>
  );
}

export function SettlementView({ draft, eventName }: { draft: Draft; eventName: string }) {
  const { resolution, settlement } = draft;
  const lines = new Map(draft.lines.map((l) => [l.no, l]));
  const failedChecks = settlement?.checks.filter((c) => !c.ok) ?? [];
  const outOfScope = resolution.blockers.filter((b) => b.reason in OUT_OF_SCOPE_LABEL);
  const invalid = resolution.blockers.filter((b) => b.reason === "invalid_item");
  const total = resolution.items.reduce((sum, it) => sum + it.amount, 0);

  return (
    <>
      {(draft.aiDraft || !draft.publishable) && (
        <section className="section" aria-live="polite">
          {!draft.publishable && (
            <div className="card warn">
              <p className="card-title">
                <IconWarn />
                아직 발행할 수 없어요
              </p>
              <ul className="dots">
                {resolution.questions.length > 0 && <li>답하지 않은 질문 {resolution.questions.length}건 (검토 탭)</li>}
                {outOfScope.length > 0 && (
                  <li>수동 정산이 필요한 줄: {outOfScope.map((b) => `${b.line}줄(${OUT_OF_SCOPE_LABEL[b.reason] ?? b.reason})`).join(", ")}</li>
                )}
                {invalid.length > 0 && <li>정보가 부족한 항목: {invalid.map((b) => (b.line ? `${b.line}줄` : "직접 입력")).join(", ")} (검토 탭)</li>}
                {failedChecks.map((c) => (
                  <li key={c.name} className="send">
                    검산 실패: {c.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {draft.aiDraft && (
            <p className={`section-footer ${s.legend}`}>
              <IconSparkle className={s.ai} />
              AI 추출 초안 · 총무 확인 후 발행
            </p>
          )}
        </section>
      )}

      {!settlement ? (
        <section className="section">
          <div className="card">
            <p className="card-title">아직 정산할 항목이 없어요</p>
            <p className="muted small">검토 탭에서 항목을 확인하거나 직접 추가해 주세요.</p>
          </div>
        </section>
      ) : (
        <>
          <section className="section" aria-label="나눌 금액">
            <div className={s.wallet}>
              <div>
                <p className={s.walletEvent}>{eventName}</p>
                <p className={s.walletMeta}>
                  {settlement.people.length}명 · 결제 {resolution.items.length}건
                </p>
              </div>
              <div>
                <p className={`num ${s.walletTotal}`}>{won(total)}</p>
                <p className={s.walletMeta}>모두 나눌 금액</p>
              </div>
            </div>
          </section>

          <section className="section" aria-labelledby="table-people">
            <h2 className="section-header" id="table-people">
              사람별
            </h2>
            <ul className={`group ${s.people}`}>
              {settlement.people.map((p, i) => {
                const tone = p.balance > 0 ? "recv" : p.balance < 0 ? "send" : "";
                return (
                  <li key={p.alias}>
                    <SheetButton
                      id={`person-${i}`}
                      title={`${p.alias} · 총부담 ${won(p.total)}`}
                      trigger={
                        <>
                          <span className={s.order}>{i + 1}</span>
                          <span className="cell-main">
                            <span className={s.alias}>{p.alias}</span>
                            <span className="cell-sub num">
                              낸 돈 {won(p.paid)} · 부담 {won(p.total)}
                            </span>
                          </span>
                          <span className="cell-end">
                            <span className={`num ${s.balance} ${tone}`}>{signedWon(p.balance)}</span>
                            <span className="caption">{p.balance > 0 ? "받을 돈" : p.balance < 0 ? "보낼 돈" : "정산 끝"}</span>
                          </span>
                          <IconChevron className="chev" />
                        </>
                      }
                    >
                      <PersonDetail person={p} items={resolution.items} lines={lines} />
                    </SheetButton>
                  </li>
                );
              })}
            </ul>
            <p className="section-footer">이름을 누르면 그 금액의 이유가 나와요. 번호는 나누어떨어지지 않는 1원이 붙는 명단 순서예요.</p>
          </section>

          <section className="section" aria-labelledby="table-items">
            <h2 className="section-header" id="table-items">
              항목
            </h2>
            <ul className="group">
              {resolution.items.map((it) => (
                <li key={it.id}>
                  <SheetButton
                    id={`item-${it.id}`}
                    title={it.name}
                    trigger={
                      <>
                        <span className="cell-main">
                          <span className={s.alias}>{it.name}</span>
                          <span className={s.itemMeta}>
                            <span className={STATUS_CHIP[it.status]}>
                              {it.status === "candidate" && <IconSparkle className={s.ai} />}
                              {STATUS_LABEL[it.status]}
                            </span>
                            <span className="caption">{it.payer} 결제</span>
                          </span>
                        </span>
                        <span className={`num ${s.itemAmount}`}>
                          {it.amount !== it.grossAmount && <s>{won(it.grossAmount)}</s>} {won(it.amount)}
                        </span>
                        <IconChevron className="chev" />
                      </>
                    }
                  >
                    <ItemEvidence item={it} lines={lines} />
                  </SheetButton>
                </li>
              ))}
            </ul>
          </section>

          <section className="section" aria-labelledby="table-transfers">
            <h2 className="section-header" id="table-transfers">
              송금안
            </h2>
            {settlement.transfers.length > 0 ? (
              <ol className="group">
                {settlement.transfers.map((t, i) => (
                  <li key={i} className="cell">
                    <span className="cell-main">
                      {t.from} → {t.to}
                    </span>
                    <b className="num">{won(t.amount)}</b>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="section-footer">주고받을 돈이 없어요.</p>
            )}
          </section>

          <section className="section" aria-labelledby="table-checks">
            <h2 className="section-header" id="table-checks">
              검산
            </h2>
            <div className="group">
              <SheetButton
                title="검산"
                trigger={
                  <>
                    <span className={`cell-main ${failedChecks.length > 0 ? s.fail : s.pass}`}>
                      {failedChecks.length > 0 ? <IconCross /> : <IconCheckCircle />}
                      {settlement.checks.filter((c) => c.ok).length}/{settlement.checks.length} 통과
                    </span>
                    <IconChevron className="chev" />
                  </>
                }
              >
                <div className="section">
                  <ul className="group">
                    {settlement.checks.map((c) => (
                      <li key={c.name} className={`cell ${s.check}`}>
                        {c.ok ? <IconCheck className={s.ok} /> : <IconCross className={s.bad} />}
                        <span className="cell-main">{c.name}</span>
                        <span className="sr">{c.ok ? " 통과" : " 실패"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </SheetButton>
            </div>
          </section>
        </>
      )}
    </>
  );
}
