"use client";

/**
 * 첫 화면의 스크롤 장면 — 담당: C
 * 기준 예시(문제정의서의 가상 사례)의 대화 여섯 줄이 정산표가 되는 과정을 스크롤에 맞춰 보여 준다.
 * 아래에 적힌 그대로가 완성된 모습이다. '동작 줄이기'를 켰거나 자바스크립트가 없으면 그 모습 그대로 보인다.
 */
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type ReactNode, useRef } from "react";
import { InkSeal, type InkSealHandle } from "./InkSeal";
import s from "./LedgerStory.module.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** 장면 순서대로. 스크롤 장면에서는 한 번에 하나씩, 그 밖에는 번호 붙은 목록으로 보인다 */
const CAPTIONS = [
  "단톡에 흩어진 여섯 줄에서 시작해요.",
  "붙여넣으면 줄마다 번호가 붙고, 실명과 전화번호는 휴대폰에서 가려져요.",
  "AI가 찾은 결제는 연필로 적어 둬요.",
  "03줄의 정정이 01줄 저녁값을 48,001원으로 고쳐요.",
  "06줄의 환불로 택시는 0원이 되고, 05줄은 정산에서 빠져요.",
  "남은 조건으로 1원까지 계산해요. 금액 옆 번호가 근거가 된 줄이에요.",
  "총무가 확정하면 도장이 찍히고, 결과 링크로 공유해요.",
];

/** 기준 예시 1판 (tests/fixtures/garam-4.json과 같은 값) */
const ROWS = [
  { alias: "가람", total: "22,002", balance: "+25,999", cites: "01·03, 02" },
  { alias: "보람", total: "22,001", balance: "+8,001", cites: "01·03, 02" },
  { alias: "다온", total: "22,000", balance: "−22,000", cites: "01·03, 02" },
  { alias: "라온", total: "12,000", balance: "−12,000", cites: "01·03" },
];
const TRANSFERS = [
  { who: "다온 → 가람", amount: "22,000원" },
  { who: "라온 → 가람", amount: "3,999원" },
  { who: "라온 → 보람", amount: "8,001원" },
];

/**
 * 대화 한 줄. 말한 사람 자리에는 붙여넣기 전의 표기(실명·시각)와 가린 뒤의 별칭을 겹쳐 두고,
 * 오른쪽에는 그 줄에서 읽어 낸 것(tag)을 적는다.
 */
function Line({ no, real, alias, tag, children }: { no: string; real: string; alias: string; tag: ReactNode; children: ReactNode }) {
  return (
    <li className={`row ${s.line}`}>
      <span className="no" data-no>
        {no}
      </span>
      <div className={s.meta}>
        <p className={s.who}>
          <span className={s.before} data-real>
            {real}
          </span>
          <span data-alias>{alias}</span>
        </p>
        <p className={s.tags}>{tag}</p>
      </div>
      {children}
    </li>
  );
}

export function LedgerStory() {
  const root = useRef<HTMLElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const seal = useRef<InkSealHandle>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference) and (min-height: 540px)", () => {
        const el = root.current;
        if (!el || !scene.current) return;
        const q = gsap.utils.selector(el);
        const caps = q("[data-cap]");
        // 도장이 찍힌 정도. 화면을 다시 잴 때(refresh) GSAP은 콜백 없이 값만 옮기므로, 값이 바뀌는 길목마다 sync로 맞춘다
        const ink = { p: 0 };
        let drawn = -1;
        const sync = () => {
          if (ink.p === drawn) return;
          drawn = ink.p;
          seal.current?.set(ink.p);
        };

        el.classList.add(s.live);
        gsap.set(caps.slice(1), { autoAlpha: 0 });
        gsap.set(q("[data-no], [data-alias], [data-mask], [data-tag], [data-new], [data-row]"), { autoAlpha: 0 });
        gsap.set(q("[data-strike]"), { scaleX: 0 });
        gsap.set(q("[data-sweep]"), { backgroundSize: "0% 100%" });
        gsap.set(q("[data-aside]"), { color: "#1b2333" });
        gsap.set(q("[data-result]"), { yPercent: 108 });

        // 도장 셰이더(three.js)는 장면이 화면에 가까워질 때 내려받는다
        ScrollTrigger.create({ trigger: el, start: "top bottom", once: true, onEnter: () => seal.current?.load() });

        const tl = gsap.timeline({
          defaults: { duration: 0.3, ease: "power2.out" },
          scrollTrigger: {
            trigger: scene.current,
            start: "top top",
            end: () => `+=${Math.round(window.innerHeight * 3.4)}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: sync,
            onRefresh: () => requestAnimationFrame(sync),
          },
        });
        const caption = (i: number, at: string) =>
          tl.to(caps[i - 1], { autoAlpha: 0, duration: 0.2 }, at).to(caps[i], { autoAlpha: 1, duration: 0.25 }, `${at}+=0.15`);

        tl.addLabel("mask", 0.5);
        caption(1, "mask");
        tl.to(q("[data-no]"), { autoAlpha: 1, stagger: 0.05 }, "mask")
          .to(q("[data-real], [data-phone]"), { autoAlpha: 0 }, "mask+=0.35")
          .to(q("[data-alias], [data-mask]"), { autoAlpha: 1 }, "mask+=0.45");

        tl.addLabel("items", 1.6);
        caption(2, "items");
        tl.to(q('[data-tag="item"]'), { autoAlpha: 1, stagger: 0.08 }, "items+=0.1");

        tl.addLabel("fix", 2.6);
        caption(3, "fix");
        tl.to(q("[data-sweep]"), { backgroundSize: "100% 100%", duration: 0.4 }, "fix+=0.1")
          .to(q('[data-tag="fix"]'), { autoAlpha: 1 }, "fix+=0.3")
          .to(q('[data-strike="dinner"]'), { scaleX: 1 }, "fix+=0.45")
          .to(q('[data-new="dinner"]'), { autoAlpha: 1 }, "fix+=0.6");

        tl.addLabel("refund", 3.6);
        caption(4, "refund");
        tl.to(q('[data-tag="refund"]'), { autoAlpha: 1 }, "refund+=0.1")
          .to(q('[data-strike="taxi"]'), { scaleX: 1 }, "refund+=0.25")
          .to(q('[data-new="taxi"]'), { autoAlpha: 1 }, "refund+=0.4")
          .to(q("[data-aside]"), { color: "#5e6570" }, "refund+=0.5")
          .to(q('[data-tag="aside"]'), { autoAlpha: 1 }, "refund+=0.55");

        tl.addLabel("table", 4.6);
        caption(5, "table");
        tl.to(q("[data-result]"), { yPercent: 0, duration: 0.5 }, "table").to(q("[data-row]"), { autoAlpha: 1, stagger: 0.08 }, "table+=0.35");

        tl.addLabel("seal", 5.7);
        caption(6, "seal");
        tl.to(ink, { p: 1, duration: 0.6, ease: "power1.out", onUpdate: sync }, "seal+=0.1")
          // 끝난 모습을 잠깐 붙잡아 둔다
          .to({}, { duration: 0.5 });
        sync();

        // 위쪽 폼의 높이가 바뀌면(참여자 추가, 행사 만든 뒤) 장면이 시작하는 위치를 다시 잰다
        const above = document.getElementById("create");
        const watcher = new ResizeObserver(() => ScrollTrigger.refresh());
        if (above) watcher.observe(above);
        document.fonts?.ready.then(() => ScrollTrigger.refresh());

        return () => {
          watcher.disconnect();
          el.classList.remove(s.live);
          seal.current?.set(1);
        };
      });
    },
    { scope: root },
  );

  return (
    <section className={s.story} ref={root} aria-labelledby="story-title">
      <div className={s.scene} ref={scene}>
        <div className={s.intro}>
          <h2 className={s.title} id="story-title">
            여섯 줄이 정산표가 되기까지
          </h2>
          <ol className={s.captions}>
            {CAPTIONS.map((c) => (
              <li key={c} data-cap>
                {c}
              </li>
            ))}
          </ol>
        </div>

        <div className={`sheet ${s.chat}`}>
          <ol>
            <Line
              no="01"
              real="[김가람] [오후 9:12]"
              alias="가람"
              tag={
                <>
                  <span className="pencil" data-tag="item">
                    저녁{" "}
                    <s className={s.old}>
                      52,001원
                      <i data-strike="dinner" />
                    </s>
                  </span>
                  <span className="pencil" data-new="dinner">
                    {" 48,001원"}
                  </span>
                </>
              }
            >
              <p>저녁 네 명 52,001원 내가 냈어</p>
            </Line>
            <Line
              no="02"
              real="[이보람] [오후 11:40]"
              alias="보람"
              tag={
                <span className="pencil" data-tag="item">
                  2차 30,002원
                </span>
              }
            >
              <p>2차 30,002원 내가 냈어. 가람·나·다온 셋이야</p>
            </Line>
            <Line no="03" real="[김가람] [오후 11:52]" alias="가람" tag={<span data-tag="fix">01줄 금액을 정정</span>}>
              <p>
                <span className={`mark ${s.sweep}`} data-sweep>
                  저녁 영수증 다시 보니 48,001원이야
                </span>
              </p>
            </Line>
            <Line
              no="04"
              real="[박다온] [오전 12:30]"
              alias="다온"
              tag={
                <>
                  <span className="pencil" data-tag="item">
                    택시{" "}
                    <s className={s.old}>
                      12,000원
                      <i data-strike="taxi" />
                    </s>
                  </span>
                  <span className="pencil" data-new="taxi">
                    {" 환불돼 0원"}
                  </span>
                </>
              }
            >
              <p>가람이랑 탄 택시 12,000원 내가 결제했어</p>
            </Line>
            <Line no="05" real="[최라온] [오전 12:31]" alias="라온" tag={<span data-tag="aside">정산 외</span>}>
              <p className={s.aside} data-aside>
                다들 조심히 들어가! 내 번호{" "}
                <span className={s.swap}>
                  <span className={s.before} data-phone>
                    010-1234-5678
                  </span>
                  <span data-mask>[전화번호]</span>
                </span>
              </p>
            </Line>
            <Line no="06" real="[박다온] [오전 10:05]" alias="다온" tag={<span data-tag="refund">04줄 택시를 환불</span>}>
              <p>그 택시비 전액 환불 들어왔어</p>
            </Line>
          </ol>
        </div>

        <div className={s.result} data-result>
          <table className={`ledger ${s.table}`}>
            <caption>정산표 1판 · 단위 원</caption>
            <thead>
              <tr>
                <th scope="col">참여자</th>
                <th scope="col">총부담</th>
                <th scope="col">잔액</th>
                <th scope="col">근거 줄</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.alias} data-row>
                  <th scope="row">{r.alias}</th>
                  <td>{r.total}</td>
                  <td className={r.balance.startsWith("+") ? "recv" : "send"}>{r.balance}</td>
                  <td className={s.cites}>{r.cites}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={s.sign}>
            <div>
              <p className={s.signLabel}>송금안</p>
              <ul className={s.transfers}>
                {TRANSFERS.map((t) => (
                  <li key={t.who} data-row>
                    {t.who} <b className="num">{t.amount}</b>
                  </li>
                ))}
              </ul>
            </div>
            <InkSeal ref={seal} version={1} size={92} />
          </div>
        </div>
      </div>
    </section>
  );
}
