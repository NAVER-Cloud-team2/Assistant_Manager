import { CreateEventForm } from "@/components/CreateEventForm";
import s from "@/components/Landing.module.css";
import { LedgerStory } from "@/components/LedgerStory";

/** S1 첫 화면 — 담당: C. 행사 만들기 폼이 먼저 나오고, 그 아래에 대화가 정산표로 바뀌는 과정을 보여 준다. */
export default function Home() {
  return (
    <main className="page" id="main">
      <header className={s.top}>
        <p className={s.brand} translate="no">
          대리총무
        </p>
        <h1 className={s.hero}>
          흩어진 단톡 발언을,
          <br />
          근거가 붙은 정산표로
        </h1>
        <p className={s.lede}>단톡 대화를 붙여넣으면 누가 왜 그 금액을 내는지 줄 번호로 짚어 드려요. 가입은 필요 없어요.</p>
      </header>

      <section className={`sheet ${s.create}`} id="create" aria-label="행사 만들기">
        <CreateEventForm />
      </section>

      <LedgerStory />

      <section className={s.close} aria-labelledby="close-title">
        <h2 className={s.closeTitle} id="close-title">
          이제 내 모임을 정산해 보세요
        </h2>
        <ul className={s.facts}>
          <li>실명·전화·계좌번호는 휴대폰에서 가린 뒤에 보내요.</li>
          <li>가린 대화는 마지막 수정 후 7일, 결과 링크는 확정 후 30일이 지나면 자동으로 지워져요.</li>
          <li>앱 설치와 회원 가입이 없어요.</li>
        </ul>
        <a className="btn wide" href="#create">
          행사 만들기
        </a>
      </section>
    </main>
  );
}
