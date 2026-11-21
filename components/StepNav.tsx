/**
 * 총무 화면 단계 이동 — 담당: C
 * 결재란 모양. 칸마다 지금 상태를 찍는다: 끝난 단계는 체크, 확인할 것이 남으면 개수, 발행했으면 판 번호 도장.
 */
import Link from "next/link";
import { IconCheck } from "./icons";
import s from "./StepNav.module.css";

export interface StepState {
  /** 붙여넣은 대화가 있다 */
  pasted: boolean;
  /** 발행을 막는 것(답하지 않은 질문, 수동 정산·정보 부족 항목)의 수 */
  todo: number;
  publishable: boolean;
  /** 발행한 최신 판 번호. 아직 없으면 null */
  published: number | null;
}

const STEPS = [
  { href: "paste", label: "붙여넣기" },
  { href: "", label: "검토" },
  { href: "table", label: "정산표" },
  { href: "publish", label: "발행" },
] as const;

export type StepHref = (typeof STEPS)[number]["href"];

function Mark({ step, state }: { step: StepHref; state: StepState }) {
  const done = (
    <>
      <IconCheck />
      <span className="sr">끝남</span>
    </>
  );
  if (step === "paste") return state.pasted ? done : null;
  if (step === "") {
    if (!state.pasted) return null;
    if (state.todo > 0)
      return (
        <span className={s.count}>
          {state.todo}
          <span className="sr">개 확인 필요</span>
        </span>
      );
    return state.publishable ? done : null;
  }
  if (step === "table") return state.publishable ? done : null;
  return state.published ? (
    <span className={s.seal}>
      {state.published}
      <span className="sr">판 발행함</span>
    </span>
  ) : null;
}

export function StepNav({ token, current, state }: { token: string; current: StepHref; state: StepState }) {
  return (
    <nav className={s.steps} aria-label="총무 화면 단계">
      {STEPS.map((t) => (
        <Link
          key={t.label}
          className={s.step}
          href={`/m/${token}${t.href ? `/${t.href}` : ""}`}
          aria-current={t.href === current ? "page" : undefined}
        >
          <span className={s.label}>{t.label}</span>
          <span className={s.mark}>
            <Mark step={t.href} state={state} />
          </span>
        </Link>
      ))}
    </nav>
  );
}
