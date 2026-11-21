import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { ReviewBoard } from "@/components/ReviewBoard";
import { loadAdminView } from "../_lib/admin";
import { loadConfirm } from "../_lib/confirm";

/** S3 검토 — 담당: C */
export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadAdminView(token);

  if (!view) {
    return (
      <main className="page">
        <h1>링크를 찾을 수 없어요</h1>
        <p>관리 링크가 맞지 않거나, 행사가 지워졌어요.</p>
        <Link href="/">새 행사 만들기</Link>
      </main>
    );
  }

  return (
    <main className="page">
      <AdminNav token={token} current="" />
      <header>
        <p className="eyebrow">{view.meta.name}</p>
        <h1>검토</h1>
      </header>
      {view.draft ? (
        <ReviewBoard
          token={token}
          eventId={view.meta.id}
          roster={view.meta.roster}
          initialDraft={view.draft}
          initialConfirm={await loadConfirm(view.meta.id)}
        />
      ) : (
        <section className="notice">
          <strong>붙여넣은 대화가 없어요</strong>
          <p>대화를 붙여넣지 않았거나, 마지막 수정 후 7일이 지나 지워졌어요.</p>
          <Link href={`/m/${token}/paste`}>대화 붙여넣기</Link>
        </section>
      )}
    </main>
  );
}
