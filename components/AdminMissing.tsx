import Link from "next/link";

/** 관리 링크가 맞지 않거나 행사가 지워졌을 때 — 담당: C. 총무 화면 네 곳이 같이 쓴다. */
export function AdminMissing() {
  return (
    <main className="page" id="main">
      <div className="sheet">
        <header className="blk head">
          <h1 className="title">링크를 찾을 수 없어요</h1>
        </header>
        <div className="blk stack">
          <p>관리 링크가 맞지 않거나, 행사가 지워졌어요.</p>
          <Link className="btn wide" href="/">
            새 행사 만들기
          </Link>
        </div>
      </div>
    </main>
  );
}
