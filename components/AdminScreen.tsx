/**
 * 총무 화면 네 곳(대화·검토·정산·발행)의 공통 틀 — 담당: C
 * 위에는 반투명 유리 막대, 그 아래 큰 제목(행사 이름 · 화면 이름), 가운데 단에 내용, 아래에 떠 있는 탭 막대.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { AppIcon } from "./icons";
import { type StepHref, StepNav, type StepState } from "./StepNav";

export function AdminScreen({
  token,
  current,
  state,
  eventName,
  title,
  children,
}: {
  token: string;
  current: StepHref;
  state: StepState;
  eventName: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="screen" id="main">
      <header className="navbar">
        <Link className="brand" href="/" translate="no">
          <AppIcon />
          대리총무
        </Link>
      </header>
      <div className="column">
        <div className="largetitle">
          <p>{eventName}</p>
          <h1>{title}</h1>
        </div>
        {children}
      </div>
      <StepNav token={token} current={current} state={state} />
    </main>
  );
}
