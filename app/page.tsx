import { CreateEventForm } from "@/components/CreateEventForm";
import { HeroCard } from "@/components/HeroCard";
import { AppIcon, IconCheckCircle, IconChevron, IconLink, IconLock, IconShare } from "@/components/icons";
import s from "@/components/Landing.module.css";
import { LedgerStory } from "@/components/LedgerStory";

/**
 * S1 첫 화면 — 담당: C
 * 애플 제품 소개처럼: 큰 제목과 휴대폰 두 대 → 대화 여섯 줄이 정산표가 되는 스크롤 장면 → 믿고 쓸 수 있는 이유 → 행사 만들기.
 */
export default function Home() {
  return (
    <main className={s.landing} id="main">
      <header className={s.nav}>
        <div className={s.navInner}>
          <a className="brand" href="#main" translate="no">
            <AppIcon />
            대리총무
          </a>
          <a className="btn small" href="#create">
            행사 만들기
          </a>
        </div>
      </header>

      <section className={s.hero} aria-labelledby="hero-title">
        <h1 className={s.headline} id="hero-title">
          흩어진 단톡 발언을,
          <br />
          근거가 붙은 정산표로
        </h1>
        <p className={s.lede}>단톡 대화를 붙여넣으면 누가 왜 그 금액을 내는지 줄 번호로 짚어 드려요. 가입은 필요 없어요.</p>
        <div className={s.actions}>
          <a className="btn" href="#create">
            행사 만들기
          </a>
          <a className={s.more} href="#story">
            어떻게 정리되나요
            <IconChevron />
          </a>
        </div>
        <HeroCard />
      </section>

      <LedgerStory />

      <section className={s.features} aria-labelledby="features-title">
        <h2 className={s.sectionTitle} id="features-title">
          총무가 믿고 보낼 수 있게
        </h2>
        <div className={s.bento}>
          <article className={`${s.tile} ${s.wide}`}>
            <div className={s.visual} aria-hidden="true">
              <p className={s.maskDemo}>
                <span className={s.blurred}>김가람</span>
                <IconChevron className={s.arrow} />
                <b>가람</b>
              </p>
              <p className={s.maskDemo}>
                <span className={s.blurred}>010-1234-5678</span>
                <IconChevron className={s.arrow} />
                <b>[전화번호]</b>
              </p>
            </div>
            <h3>
              <IconLock />
              실명은 휴대폰에서 가려요
            </h3>
            <p>이름은 별칭으로, 전화·계좌번호는 가린 뒤에 보내요. 실명이 담긴 원문은 서버로 가지 않아요.</p>
          </article>
          <article className={s.tile}>
            <div className={s.visual} aria-hidden="true">
              <p className={s.bigNum}>22,002원</p>
              <p className={s.cites}>
                <span className="chip blue">01·03줄</span>
                <span className="chip blue">02줄</span>
              </p>
            </div>
            <h3>금액마다 근거 줄</h3>
            <p>누가 왜 그 금액을 내는지, 근거가 된 대화의 줄 번호로 짚어 줘요.</p>
          </article>
          <article className={s.tile}>
            <div className={s.visual} aria-hidden="true">
              <p className={s.calc}>48,001원 ÷ 4명</p>
              <p className={s.split}>
                <b>12,001</b>
                <span>12,000</span>
                <span>12,000</span>
                <span>12,000</span>
              </p>
            </div>
            <h3>1원까지 정확하게</h3>
            <p>나누어떨어지지 않는 1원은 명단 순서대로 붙여요. 계산은 AI가 아니라 정해진 규칙으로 해요.</p>
          </article>
          <article className={`${s.tile} ${s.wide}`}>
            <div className={s.visual} aria-hidden="true">
              <p className={s.linkDemo}>
                <IconLink />
                결과 링크 하나
              </p>
              <span className="btn small">
                <IconShare />
                공유하기
              </span>
            </div>
            <h3>가입도 설치도 없이</h3>
            <p>결과 링크 하나로 모임원 모두가 자기 몫과 그 이유를 봐요. 확정 후 30일이 지나면 저절로 지워져요.</p>
          </article>
        </div>
      </section>

      <section className={s.create} id="create" aria-labelledby="create-title">
        <div className={s.createGrid}>
          <div className={s.createCopy}>
            <h2 className={s.sectionTitle} id="create-title">
              이제 내 모임을
              <br />
              정산해 보세요
            </h2>
            <p className={s.createLede}>행사를 만들면 총무 전용 관리 링크가 생겨요. 그 링크로 언제든 돌아와 이어서 할 수 있어요.</p>
            <ul className={s.facts}>
              <li>
                <IconCheckCircle />
                실명·전화·계좌번호는 휴대폰에서 가린 뒤에 보내요.
              </li>
              <li>
                <IconCheckCircle />
                가린 대화는 마지막 수정 후 7일, 결과 링크는 확정 후 30일이 지나면 자동으로 지워져요.
              </li>
              <li>
                <IconCheckCircle />
                앱 설치와 회원 가입이 없어요.
              </li>
            </ul>
          </div>
          <div className={s.formCard}>
            <CreateEventForm />
          </div>
        </div>
      </section>

      <footer className={s.footer}>
        <p translate="no">대리총무</p>
        <p>대화 원문은 서버에 남기지 않아요. 결과 페이지에는 별칭·항목·금액만 있어요.</p>
      </footer>
    </main>
  );
}
