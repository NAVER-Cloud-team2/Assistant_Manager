/**
 * 첫 화면의 휴대폰 두 대 — 담당: C
 * 앞: 모임원이 받는 결과 링크, 뒤: 총무의 검토 화면. 기준 예시(tests/fixtures/garam-4.json) 1판의 고정값이다.
 * 안쪽은 실제 앱과 같은 스타일로 그린 그림이라 보조 기술에서는 숨기고, 그림 설명만 읽어 준다.
 */
import s from "./HeroCard.module.css";
import { AppIcon, IconChevron, IconShare, IconSparkle, IconTabChat, IconTabReview, IconTabSend, IconTabTable, IconWarn } from "./icons";
import { Phone } from "./Phone";
import { Seal } from "./Seal";

const PEOPLE = [
  { alias: "가람", text: "25,999원 받을 돈", total: "22,002원", tone: "recv" },
  { alias: "보람", text: "8,001원 받을 돈", total: "22,001원", tone: "recv" },
  { alias: "다온", text: "22,000원 보낼 돈", total: "22,000원", tone: "send" },
  { alias: "라온", text: "12,000원 보낼 돈", total: "12,000원", tone: "send" },
];
const TRANSFERS = [
  { who: "다온 → 가람", amount: "22,000원" },
  { who: "라온 → 가람", amount: "3,999원" },
  { who: "라온 → 보람", amount: "8,001원" },
];

/** 총무 화면 아래의 탭 막대 그림 (components/StepNav와 같은 모양) */
function MiniTabBar() {
  const tabs = [
    { label: "대화", Icon: IconTabChat },
    { label: "검토", Icon: IconTabReview, on: true, badge: 1 },
    { label: "정산", Icon: IconTabTable },
    { label: "발행", Icon: IconTabSend },
  ];
  return (
    <div className={s.tabbar}>
      {tabs.map(({ label, Icon, on, badge }) => (
        <span key={label} className={on ? `${s.tab} ${s.tabOn}` : s.tab}>
          <span className={s.tabIcon}>
            <Icon />
            {badge && <span className={`badge ${s.tabBadge}`}>{badge}</span>}
          </span>
          {label}
        </span>
      ))}
    </div>
  );
}

export function HeroCard() {
  return (
    <figure className={s.stage} aria-label="예시 화면: 총무의 검토 화면과 모임원이 받는 정산 결과">
      {/* 뒤: 총무의 검토 화면 */}
      <div className={s.back} aria-hidden="true">
        <Phone className={s.phoneBack}>
          <div className={s.nav}>
            <span className="brand">
              <AppIcon />
              대리총무
            </span>
          </div>
          <div className="largetitle">
            <p>대화 6줄 · AI 초안</p>
            <p className={s.lt}>동아리 뒤풀이</p>
          </div>
          <div className="section">
            <div className="card warn">
              <p className="card-title">
                <IconWarn />
                확인할 게 1개 있어요
              </p>
              <p className="small">06줄 환불을 반영할까요?</p>
              <div className="actions row">
                <span className="btn small">0원으로</span>
                <span className="btn gray small">그대로</span>
              </div>
            </div>
          </div>
          <div className="section">
            <p className="section-header">대화</p>
            <ul className={`group ${s.lines}`}>
              <li className={`cell ${s.line}`}>
                <span className={s.no}>01</span>
                <span className={s.said}>
                  <b>가람</b>
                  <span>저녁 네 명 52,001원 내가 냈어</span>
                  <span className="chip">
                    <IconSparkle className={s.ai} />
                    저녁 48,001원
                  </span>
                </span>
              </li>
              <li className={`cell ${s.line}`}>
                <span className={s.no}>03</span>
                <span className={s.said}>
                  <b>가람</b>
                  <span>
                    <span className="hl">저녁 영수증 다시 보니 48,001원이야</span>
                  </span>
                </span>
              </li>
              <li className={`cell ${s.line} ${s.dim}`}>
                <span className={s.no}>05</span>
                <span className={s.said}>
                  <b>라온</b>
                  <span>다들 조심히 들어가!</span>
                  <span className="chip">정산 외</span>
                </span>
              </li>
            </ul>
          </div>
          <MiniTabBar />
        </Phone>
      </div>

      {/* 앞: 모임원이 받는 결과 링크 */}
      <div className={s.front} aria-hidden="true">
        <Phone className={s.phoneFront} lightStatus>
          <div className={s.cover}>
            <p className={s.kicker}>
              <AppIcon />
              대리총무 정산 결과
            </p>
            <p className={s.title}>동아리 뒤풀이</p>
            <p className={s.until}>12월 22일까지 볼 수 있어요</p>
            <Seal version={1} size={92} className={s.seal} stamp />
          </div>
          <div className="section">
            <p className="section-header">사람별 부담</p>
            <ul className="group">
              {PEOPLE.map((p) => (
                <li key={p.alias} className="cell">
                  <span className="cell-main">
                    <b className={s.alias}>{p.alias}</b>
                    <span className={`${s.balance} ${p.tone}`}>{p.text}</span>
                  </span>
                  <b className="num">{p.total}</b>
                  <IconChevron className="chev" />
                </li>
              ))}
            </ul>
          </div>
          <div className="section">
            <p className="section-header">송금 안내</p>
            <ul className="group">
              {TRANSFERS.map((t) => (
                <li key={t.who} className="cell">
                  <span className="cell-main">{t.who}</span>
                  <b className="num">{t.amount}</b>
                </li>
              ))}
            </ul>
          </div>
          <div className="actions">
            <span className="btn gray wide">
              <IconShare />이 결과 공유하기
            </span>
          </div>
        </Phone>
      </div>
    </figure>
  );
}
