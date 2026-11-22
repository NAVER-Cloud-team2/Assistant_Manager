import Link from "next/link";
import { IconTabChat } from "./icons";

/** 붙여넣은 대화가 없을 때 — 담당: C. 검토·정산 화면이 같이 쓴다. */
export function NoDraft({ token }: { token: string }) {
  return (
    <section className="section">
      <div className="card">
        <p className="card-title">
          <IconTabChat />
          붙여넣은 대화가 없어요
        </p>
        <p className="muted small">대화를 붙여넣지 않았거나, 마지막 수정 후 7일이 지나 지워졌어요.</p>
      </div>
      <div className="actions">
        <Link className="btn wide" href={`/m/${token}/paste`}>
          대화 붙여넣기
        </Link>
      </div>
    </section>
  );
}
