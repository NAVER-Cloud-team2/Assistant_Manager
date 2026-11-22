import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadResult } from "@/app/api/_lib/result";
import { AppIcon, IconChevron, IconClock } from "@/components/icons";
import { Seal } from "@/components/Seal";
import { ShareButton } from "@/components/ShareButton";
import type { ResultView } from "@/lib/types";
import styles from "./page.module.css";

/**
 * S6 결과 페이지 — 담당: D. 모임원용, 읽기 전용. 원 발언은 절대 보이지 않는다.
 * 데이터는 ResultView(별칭·항목·금액·버전)만 쓴다. 토큰은 화면·로그에 남기지 않는다.
 * 모양은 C의 애플 앱 틀을 따른다: 지갑 카드 같은 표지 위에 확정 표시(components/Seal), 아래로 묶음 목록.
 */
export const metadata: Metadata = {
  title: "대리총무 · 정산 결과",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// 매 요청마다 최신 판을 읽는다 (같은 링크가 2판으로 바뀜)
export const dynamic = "force-dynamic";

// 표기는 단톡 문구(lib/version.ts, A)와 맞춘다: "+1,500원" / "-1,500원" / "25,999원 받을 돈" / "정산 끝"
const won = (n: number) => `${Math.abs(n).toLocaleString("ko-KR")}원`;
/** 잔액 표시: +받을 돈 / -보낼 돈 / 0원 */
const signed = (n: number) => (n === 0 ? "0원" : `${n > 0 ? "+" : "-"}${won(n)}`);
/** 변동 표시: 0이면 '변동 없음' */
const signedWon = (n: number) => (n === 0 ? "변동 없음" : signed(n));
const dateKo = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });

function balanceText(balance: number): string {
  if (balance > 0) return `${won(balance)} 받을 돈`;
  if (balance < 0) return `${won(balance)} 보낼 돈`;
  return "정산 끝";
}
/** 받을 돈은 파랑, 보낼 돈은 빨강 (app/globals.css). 글자로도 구분되므로 색은 보조다 */
const tone = (n: number) => (n > 0 ? "recv" : n < 0 ? "send" : "");

/** 이전 공유 '있음/모름'이라 송금안을 싣지 않을 때. 변동액 표가 있는 판(2판~)과 없는 판(1판)의 안내를 나눈다. */
function noTransferText(hasDiff: boolean): string {
  const base = "이미 주고받은 돈이 있을 수 있어 송금 안내는 싣지 않았어요.";
  return hasDiff
    ? `${base} 위의 변동 금액을 보고 총무와 확인해 주세요.`
    : `${base} 위의 사람별 받을 돈·보낼 돈을 보고 총무와 확인해 주세요.`;
}

export default async function ResultPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await loadResult(token);
  if (r.status === "not_found") notFound();
  if (r.status === "unpublished") {
    return (
      <main className={`screen ${styles.empty}`} id="main">
        <div className="column">
          <p className={styles.mark} translate="no">
            <AppIcon />
            대리총무
          </p>
          <IconClock className={styles.emptyIcon} />
          <h1 className={styles.emptyTitle}>아직 발행된 정산이 없어요</h1>
          <p className="muted">총무가 정산을 확정하면 이 링크에서 볼 수 있어요.</p>
        </div>
      </main>
    );
  }
  return <ResultBody view={r.view} />;
}

function ResultBody({ view }: { view: ResultView }) {
  const { eventName, version, replaces, people, transfers, diff, expiresAt } = view;
  return (
    <main className={`screen ${styles.result}`} id="main">
      <header className={styles.cover}>
        <div className={styles.coverInner}>
          <p className={styles.kicker} translate="no">
            <AppIcon />
            대리총무 정산 결과
          </p>
          <h1 className={styles.title}>{eventName}</h1>
          <p className={styles.until}>
            <span>{dateKo.format(new Date(expiresAt))}까지 볼 수 있어요</span>
          </p>
          <Seal version={version} size={92} className={styles.seal} />
        </div>
      </header>

      <div className="column">
        {replaces !== null && (
          <section className={`card warn ${styles.notice}`} aria-label="판 교체 안내">
            <strong>
              {replaces}판을 대체하는 {version}판
            </strong>
            <p className="small">정산 조건이 바뀌었어요. 이전에 받은 금액 대신 이 페이지의 금액을 봐 주세요.</p>
          </section>
        )}

        {diff && diff.length > 0 && (
          <section className="section" aria-labelledby="diff-title">
            <h2 className="section-header" id="diff-title">
              {replaces ?? version - 1}판 대비 변동
            </h2>
            <div className="card">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">이름</th>
                    <th scope="col">이전</th>
                    <th scope="col">지금</th>
                    <th scope="col">변동</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.map((d) => (
                    <tr key={d.alias}>
                      <th scope="row">{d.alias}</th>
                      <td>{signed(d.before)}</td>
                      <td>{signed(d.after)}</td>
                      <td className={d.delta === 0 ? styles.same : `${styles.changed} ${tone(d.delta)}`}>{signedWon(d.delta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="section-footer">받을 돈은 +, 보낼 돈은 - 로 표시해요.</p>
          </section>
        )}

        <section className="section" aria-labelledby="people-title">
          <h2 className="section-header" id="people-title">
            사람별 부담
          </h2>
          <ul className="group">
            {people.map((p) => {
              const joined = p.lines.filter((l) => l.reason !== "참여 안 함");
              const skipped = p.lines.filter((l) => l.reason === "참여 안 함");
              return (
                <li key={p.alias}>
                  <details className={styles.person}>
                    <summary className="cell tap">
                      <span className="cell-main">
                        <span className={styles.alias}>{p.alias}</span>
                        <span className={`${styles.balance} ${tone(p.balance)}`}>{balanceText(p.balance)}</span>
                      </span>
                      <span className={styles.total}>{won(p.total)}</span>
                      <IconChevron className="chev" />
                    </summary>
                    <ul className={styles.lines}>
                      {joined.map((l) => (
                        <li key={l.item} className="cell">
                          <span className="cell-main">
                            <span className="cell-title">{l.item}</span>
                            <span className="cell-sub">{l.reason}</span>
                          </span>
                          <span className={styles.amount}>{won(l.amount)}</span>
                        </li>
                      ))}
                    </ul>
                    {skipped.length > 0 && <p className={styles.skipped}>참여 안 함: {skipped.map((l) => l.item).join(", ")}</p>}
                  </details>
                </li>
              );
            })}
          </ul>
          <p className="section-footer">이름을 누르면 항목별 계산 이유가 보여요.</p>
        </section>

        <section className="section" aria-labelledby="transfer-title">
          <h2 className="section-header" id="transfer-title">
            송금 안내
          </h2>
          {transfers === null ? (
            <div className="card">
              <p className="small muted">{noTransferText(Boolean(diff && diff.length > 0))}</p>
            </div>
          ) : transfers.length === 0 ? (
            <div className="card">
              <p className="small muted">주고받을 돈이 없어요.</p>
            </div>
          ) : (
            <ul className="group">
              {transfers.map((t) => (
                <li key={`${t.from}-${t.to}`} className="cell">
                  <span className="cell-main">
                    {t.from} → {t.to}
                  </span>
                  <span className={styles.amount}>{won(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="actions">
          <ShareButton title={`${eventName} 정산 결과`} label="이 결과 공유하기" className="btn gray wide" />
        </div>

        <footer className={`section-footer ${styles.footer}`}>
          이 페이지에는 별칭·항목·금액만 있고 대화 원문은 없어요. 링크는 확정 후 30일이 지나면 사라져요.
        </footer>
      </div>
    </main>
  );
}
