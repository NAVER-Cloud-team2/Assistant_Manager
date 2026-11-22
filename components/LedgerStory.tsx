"use client";

/**
 * 첫 화면의 스크롤 장면 — 담당: C
 * 기준 예시(문제정의서의 가상 사례)의 단톡 여섯 줄이 정산표가 되는 과정을 스크롤에 맞춰 보여 준다.
 * 넓은 화면은 애플 제품 소개처럼 왼쪽에 단계, 오른쪽에 고정된 아이폰. 좁은 화면은 앱 화면을 폭 가득 보여 준다.
 * 아래에 적힌 그대로가 완성된 모습이다. '동작 줄이기'를 켰거나 자바스크립트가 없으면 그 모습 그대로 보인다.
 * 스크롤 장면: 흩어진 말풍선 → 번호 붙은 목록(실명은 흐려지며 별칭으로) → AI가 훑으며 결제를 찾음 → 정정·환불 → 정산 시트 → 확정 표시.
 */
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type ReactNode, useRef } from "react";
import { IconSparkle } from "./icons";
import s from "./LedgerStory.module.css";
import { StatusIcons } from "./Phone";
import { Seal } from "./Seal";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** 장면 순서대로. 좁은 화면의 스크롤 장면에서는 한 번에 하나씩, 그 밖에는 번호 붙은 목록으로 보인다 */
const CAPTIONS = [
  "단톡에 흩어진 여섯 줄에서 시작해요.",
  "붙여넣으면 줄마다 번호가 붙고, 실명과 전화번호는 휴대폰에서 가려져요.",
  "AI가 찾은 결제는 반짝이로 표시해 둬요.",
  "03줄의 정정이 01줄 저녁값을 48,001원으로 고쳐요.",
  "06줄의 환불로 택시는 0원이 되고, 05줄은 정산에서 빠져요.",
  "남은 조건으로 1원까지 계산해요. 금액 옆 번호가 근거가 된 줄이에요.",
  "총무가 확정하면 확정 표시가 찍히고, 결과 링크로 공유해요.",
];

/** 기준 예시 1판 (tests/fixtures/garam-4.json과 같은 값) */
const ROWS = [
  { alias: "가람", balance: "+25,999원", cites: "01·03, 02", tone: "recv" },
  { alias: "보람", balance: "+8,001원", cites: "01·03, 02", tone: "recv" },
  { alias: "다온", balance: "−22,000원", cites: "01·03, 02", tone: "send" },
  { alias: "라온", balance: "−12,000원", cites: "01·03", tone: "send" },
];

/** 붙여넣기 전 말풍선이 흩어진 정도: [가로 px, 세로 px, 기울기 deg] */
const SCATTER: [number, number, number][] = [
  [8, 0, -2.5],
  [28, 4, 2],
  [2, -2, -1.5],
  [22, 6, 2.5],
  [12, 2, -2],
  [34, -2, 1.5],
];

/**
 * 대화 한 줄. 말한 사람 자리에는 붙여넣기 전의 표기(실명·시각)와 가린 뒤의 별칭을 겹쳐 두고,
 * 아래에는 그 줄에서 읽어 낸 것(chips)을 적는다.
 */
function Line({ no, name, time, alias, chips, children }: { no: string; name: string; time: string; alias: string; chips: ReactNode; children: ReactNode }) {
  return (
    <li className={s.row}>
      <i className={s.sep} data-sep aria-hidden="true" />
      <span className={s.no} data-no>
        {no}
      </span>
      <div className={s.main}>
        <div className={s.bubble} data-bubble>
          <p className={s.who}>
            <span className={s.real} data-real>
              {name}
              <small>{time}</small>
            </span>
            <span className={s.alias} data-alias>
              {alias}
            </span>
          </p>
          {children}
        </div>
        <p className={s.chips}>{chips}</p>
      </div>
    </li>
  );
}

export function LedgerStory() {
  const root = useRef<HTMLElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference) and (min-height: 540px)",
          wide: "(min-width: 960px)",
        },
        (ctx) => {
          const { motion = false, wide = false } = ctx.conditions ?? {};
          const el = root.current;
          const rows = list.current;
          const panel = sheet.current;
          if (!motion || !el || !scene.current || !rows || !panel) return;
          const q = gsap.utils.selector(el);
          const caps = q("[data-cap]");
          const css = getComputedStyle(el);
          const label = css.getPropertyValue("--label").trim();
          const label2 = css.getPropertyValue("--label-2").trim();

          el.classList.add(s.live);
          q("[data-bubble]").forEach((b, i) => {
            const [x, y, r] = SCATTER[i] ?? [0, 0, 0];
            gsap.set(b, { x: wide ? x * 1.4 : x, y, rotation: r });
          });
          if (wide) gsap.set(caps.slice(1), { opacity: 0.32 });
          else gsap.set(caps.slice(1), { autoAlpha: 0 });
          gsap.set(q("[data-no], [data-tag], [data-new], [data-cell], [data-glow], [data-stamp]"), { autoAlpha: 0 });
          gsap.set(q("[data-alias], [data-mask]"), { autoAlpha: 0, filter: "blur(6px)" });
          gsap.set(q("[data-sep], [data-strike]"), { scaleX: 0 });
          gsap.set(q("[data-sweep]"), { backgroundSize: "0% 100%" });
          gsap.set(q("[data-aside]"), { color: label });

          const tl = gsap.timeline({
            defaults: { duration: 0.3, ease: "power2.out" },
            scrollTrigger: {
              trigger: scene.current,
              start: "top top",
              end: () => `+=${Math.round(window.innerHeight * 3.8)}`,
              pin: true,
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          });
          const caption = (i: number, at: string) => {
            if (wide) tl.to(caps[i - 1], { opacity: 0.32, duration: 0.2 }, at).to(caps[i], { opacity: 1, duration: 0.25 }, at);
            else tl.to(caps[i - 1], { autoAlpha: 0, duration: 0.2 }, at).to(caps[i], { autoAlpha: 1, duration: 0.25 }, `${at}+=0.15`);
          };

          // 붙여넣기: 말풍선이 번호 붙은 목록으로 정렬되고, 실명·전화번호는 흐려지며 별칭으로 바뀐다
          tl.addLabel("mask", 0.6);
          caption(1, "mask");
          tl.to(q("[data-bubble]"), { x: 0, y: 0, rotation: 0, duration: 0.6, ease: "power3.inOut" }, "mask")
            .to(q("[data-bubble]"), { backgroundColor: "rgba(233, 233, 235, 0)", duration: 0.4 }, "mask+=0.3")
            .to(rows, { backgroundColor: "#ffffff", duration: 0.4 }, "mask+=0.3")
            .to(q("[data-sep]"), { scaleX: 1, duration: 0.4, stagger: 0.05, ease: "power1.inOut" }, "mask+=0.35")
            .to(q("[data-no]"), { autoAlpha: 1, stagger: 0.05 }, "mask+=0.4")
            .to(q("[data-real], [data-phone]"), { autoAlpha: 0, filter: "blur(6px)", duration: 0.3, stagger: 0.03 }, "mask+=0.55")
            .to(q("[data-alias], [data-mask]"), { autoAlpha: 1, filter: "blur(0px)", duration: 0.3, stagger: 0.03 }, "mask+=0.7");

          // 빈 정산 시트가 목록 바로 아래까지 올라와 기다린다 (명단만 적혀 있고 금액 칸은 비어 있다)
          const below = () => panel.offsetHeight + 40;
          const waiting = () => Math.max(0, rows.offsetTop + rows.offsetHeight + 14 - panel.offsetTop);
          tl.fromTo(panel, { y: below }, { y: waiting, duration: 0.5 }, "mask+=1.15");

          // AI가 결제를 찾는다: 빛이 위에서 아래로 훑고, 지나간 줄에 반짝이 표시가 남는다
          tl.addLabel("items", 2.2);
          caption(2, "items");
          tl.fromTo(
            q("[data-glow]"),
            { y: () => rows.offsetTop - 40 },
            { y: () => rows.offsetTop + rows.offsetHeight - 40, duration: 0.9, ease: "none" },
            "items",
          )
            .to(q("[data-glow]"), { autoAlpha: 1, duration: 0.08 }, "items")
            .to(q("[data-glow]"), { autoAlpha: 0, duration: 0.12 }, "items+=0.82");
          const lines = q("[data-bubble]").map((b) => b.closest("li"));
          q('[data-tag="item"]').forEach((tag) => {
            const at = (lines.indexOf(tag.closest("li")) / lines.length) * 0.9 + 0.12;
            tl.to(tag, { autoAlpha: 1, duration: 0.2 }, `items+=${at.toFixed(2)}`);
          });

          // 정정: 03줄에 형광펜이 켜지고, 01줄 금액에 빨간 줄이 그어진다
          tl.addLabel("fix", 3.4);
          caption(3, "fix");
          tl.to(q("[data-sweep]"), { backgroundSize: "100% 100%", duration: 0.4 }, "fix+=0.1")
            .to(q('[data-tag="fix"]'), { autoAlpha: 1 }, "fix+=0.3")
            .to(q('[data-strike="dinner"]'), { scaleX: 1 }, "fix+=0.45")
            .to(q('[data-new="dinner"]'), { autoAlpha: 1 }, "fix+=0.6");

          // 환불과 정산 외
          tl.addLabel("refund", 4.5);
          caption(4, "refund");
          tl.to(q('[data-tag="refund"]'), { autoAlpha: 1 }, "refund+=0.1")
            .to(q('[data-strike="taxi"]'), { scaleX: 1 }, "refund+=0.25")
            .to(q('[data-new="taxi"]'), { autoAlpha: 1 }, "refund+=0.4")
            .to(q("[data-aside]"), { color: label2 }, "refund+=0.5")
            .to(q('[data-tag="aside"]'), { autoAlpha: 1 }, "refund+=0.55");

          // 계산: 시트가 다 올라오고, 금액 칸이 한 줄씩 채워진다
          tl.addLabel("table", 5.6);
          caption(5, "table");
          tl.to(panel, { y: 0, duration: 0.5 }, "table");
          q("[data-person]").forEach((row, i) => {
            tl.to(row.querySelectorAll("[data-cell]"), { autoAlpha: 1, duration: 0.2, stagger: 0.04 }, `table+=${(0.3 + i * 0.1).toFixed(2)}`);
          });

          // 확정: 확정 표시가 튀어나와 자리를 잡고, 체크가 그려진다
          tl.addLabel("seal", 6.8);
          caption(6, "seal");
          tl.to(q("[data-slot]"), { autoAlpha: 0, duration: 0.1 }, "seal+=0.1")
            .fromTo(q("[data-stamp]"), { scale: 0.4, rotation: -20 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.45, ease: "back.out(2.2)" }, "seal+=0.1")
            .fromTo(q("[data-stamp] [data-check]"), { strokeDashoffset: 44 }, { strokeDashoffset: 0, duration: 0.35, ease: "power2.out" }, "seal+=0.4")
            // 끝난 모습을 잠깐 붙잡아 둔다
            .to({}, { duration: 0.5 });
          if (!wide) tl.fromTo(q("[data-progress]"), { scaleX: 0 }, { scaleX: 1, duration: tl.duration(), ease: "none" }, 0);

          // 위쪽 첫 화면의 높이가 바뀌면(글꼴을 받은 뒤 등) 장면이 시작하는 위치를 다시 잰다
          const watcher = new ResizeObserver(() => ScrollTrigger.refresh());
          if (el.previousElementSibling) watcher.observe(el.previousElementSibling);
          document.fonts?.ready.then(() => ScrollTrigger.refresh());

          return () => {
            watcher.disconnect();
            el.classList.remove(s.live);
          };
        },
      );
    },
    { scope: root },
  );

  return (
    <section className={s.story} ref={root} id="story" aria-labelledby="story-title">
      {/* 좁은 화면의 스크롤 장면: 제목은 고정되는 장면 위에 두고 지나가게 한다 (자리를 앱 화면에 내준다) */}
      <p className={s.titleTop} aria-hidden="true">
        여섯 줄이 정산표가 되기까지
      </p>
      <div className={s.scene} ref={scene}>
        <div className={s.grid}>
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
            <div className={s.progress} aria-hidden="true">
              <i data-progress />
            </div>
          </div>

          <div className={s.device}>
            <div className={s.screen}>
              <span className={s.island} aria-hidden="true" />
              <div className={s.content}>
                <div className={s.statusbar} aria-hidden="true">
                  <span>9:41</span>
                  <StatusIcons />
                </div>
                <div className={s.appbar}>
                  <p className={s.appSub}>대화 6줄</p>
                  <p className={s.appTitle}>동아리 뒤풀이</p>
                </div>
                <ol className={s.list} ref={list}>
                  <Line
                    no="01"
                    name="김가람"
                    time="오후 9:12"
                    alias="가람"
                    chips={
                      <>
                        <span className="chip" data-tag="item">
                          <IconSparkle className={s.ai} />
                          저녁{" "}
                          <span className={s.old}>
                            52,001원
                            <i data-strike="dinner" />
                          </span>
                        </span>
                        <span className="chip blue" data-new="dinner">
                          48,001원
                        </span>
                      </>
                    }
                  >
                    <p className={s.text}>저녁 네 명 52,001원 내가 냈어</p>
                  </Line>
                  <Line
                    no="02"
                    name="이보람"
                    time="오후 11:40"
                    alias="보람"
                    chips={
                      <span className="chip" data-tag="item">
                        <IconSparkle className={s.ai} />
                        2차 30,002원
                      </span>
                    }
                  >
                    <p className={s.text}>2차 30,002원 내가 냈어. 가람·나·다온 셋이야</p>
                  </Line>
                  <Line
                    no="03"
                    name="김가람"
                    time="오후 11:52"
                    alias="가람"
                    chips={
                      <span className="chip blue" data-tag="fix">
                        01줄 금액을 정정
                      </span>
                    }
                  >
                    <p className={s.text}>
                      <span className={`hl ${s.sweep}`} data-sweep>
                        저녁 영수증 다시 보니 48,001원이야
                      </span>
                    </p>
                  </Line>
                  <Line
                    no="04"
                    name="박다온"
                    time="오전 12:30"
                    alias="다온"
                    chips={
                      <>
                        <span className="chip" data-tag="item">
                          <IconSparkle className={s.ai} />
                          택시{" "}
                          <span className={s.old}>
                            12,000원
                            <i data-strike="taxi" />
                          </span>
                        </span>
                        <span className="chip blue" data-new="taxi">
                          0원
                        </span>
                      </>
                    }
                  >
                    <p className={s.text}>가람이랑 탄 택시 12,000원 내가 결제했어</p>
                  </Line>
                  <Line
                    no="05"
                    name="최라온"
                    time="오전 12:31"
                    alias="라온"
                    chips={
                      <span className="chip" data-tag="aside">
                        정산 외
                      </span>
                    }
                  >
                    <p className={s.text} data-aside>
                      다들 조심히 들어가! 내 번호{" "}
                      <span className={s.swap}>
                        <span className={s.real} data-phone>
                          010-1234-5678
                        </span>
                        <span className={s.masked} data-mask>
                          [전화번호]
                        </span>
                      </span>
                    </p>
                  </Line>
                  <Line
                    no="06"
                    name="박다온"
                    time="오전 10:05"
                    alias="다온"
                    chips={
                      <span className="chip blue" data-tag="refund">
                        04줄 택시를 환불
                      </span>
                    }
                  >
                    <p className={s.text}>그 택시비 전액 환불 들어왔어</p>
                  </Line>
                </ol>
                <i className={s.glow} data-glow aria-hidden="true" />

                <div className={s.sheet} ref={sheet}>
                  <span className={s.grabber} aria-hidden="true" />
                  <div className={s.wallet}>
                    <div>
                      <p className={s.walletEvent}>정산 1판</p>
                      <p className={s.walletMeta}>4명 · 결제 3건</p>
                    </div>
                    <p className={`num ${s.walletTotal}`}>78,003원</p>
                    <span className={s.slot} data-slot aria-hidden="true" />
                    <div className={s.seal} data-stamp>
                      <Seal version={1} size={78} />
                    </div>
                  </div>
                  <table className={s.table}>
                    <caption className="sr">정산표 1판 · 단위 원</caption>
                    <thead>
                      <tr>
                        <th scope="col">참여자</th>
                        <th scope="col">근거 줄</th>
                        <th scope="col">잔액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 명단은 행사를 만들 때 정해지므로 먼저 적혀 있고, 금액 칸(data-cell)은 계산한 뒤에 채워진다 */}
                      {ROWS.map((r) => (
                        <tr key={r.alias} data-person>
                          <th scope="row">{r.alias}</th>
                          <td className={s.cites}>
                            <span data-cell>{r.cites}</span>
                          </td>
                          <td className={`num ${r.tone} ${s.bal}`}>
                            <span data-cell>{r.balance}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
