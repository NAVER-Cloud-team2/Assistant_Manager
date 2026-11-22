/**
 * 총무 화면 아래의 탭 막대 — 담당: C
 * 애플 앱처럼 화면 아래에 떠 있는 유리 막대. 확인할 것이 남으면 검토 탭에 빨간 숫자를, 발행했으면 발행 탭에 판 번호를 단다.
 */
import Link from "next/link";
import { IconTabChat, IconTabReview, IconTabSend, IconTabTable } from "./icons";
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
  { href: "paste", label: "대화", Icon: IconTabChat },
  { href: "", label: "검토", Icon: IconTabReview },
  { href: "table", label: "정산", Icon: IconTabTable },
  { href: "publish", label: "발행", Icon: IconTabSend },
] as const;

export type StepHref = (typeof STEPS)[number]["href"];

function Badge({ step, state }: { step: StepHref; state: StepState }) {
  if (step === "" && state.pasted && state.todo > 0)
    return (
      <span className={`badge ${s.badge}`}>
        {state.todo}
        <span className="sr">개 확인 필요</span>
      </span>
    );
  if (step === "publish" && state.published)
    return (
      <span className={s.version}>
        {state.published}판<span className="sr"> 발행함</span>
      </span>
    );
  return null;
}

export function StepNav({ token, current, state }: { token: string; current: StepHref; state: StepState }) {
  return (
    <nav className={s.bar} aria-label="총무 화면 단계">
      {STEPS.map(({ href, label, Icon }) => (
        <Link
          key={label}
          className={s.tab}
          href={`/m/${token}${href ? `/${href}` : ""}`}
          aria-current={href === current ? "page" : undefined}
        >
          <span className={s.icon}>
            <Icon />
            <Badge step={href} state={state} />
          </span>
          <span className={s.label}>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
