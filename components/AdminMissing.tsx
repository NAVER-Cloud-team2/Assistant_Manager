import Link from "next/link";
import { AppIcon, IconLink } from "./icons";

/** 관리 링크가 맞지 않거나 행사가 지워졌을 때 — 담당: C. 총무 화면 네 곳이 같이 쓴다. */
export function AdminMissing() {
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
          <h1>링크를 찾을 수 없어요</h1>
        </div>
        <section className="section">
          <div className="card">
            <p className="card-title">
              <IconLink />
              관리 링크가 맞지 않거나, 행사가 지워졌어요.
            </p>
          </div>
          <div className="actions">
            <Link className="btn wide" href="/">
              새 행사 만들기
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
