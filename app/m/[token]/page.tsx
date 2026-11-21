import Link from "next/link";
import { AdminMissing } from "@/components/AdminMissing";
import { ReviewBoard } from "@/components/ReviewBoard";
import { StepNav } from "@/components/StepNav";
import { loadAdminView, loadStepState } from "../_lib/admin";
import { loadConfirm } from "../_lib/confirm";

/** S3 검토 — 담당: C */
export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadAdminView(token);
  if (!view) return <AdminMissing />;

  return (
    <main className="page" id="main">
      <StepNav token={token} current="" state={await loadStepState(view)} />
      <div className="sheet">
        <header className="blk head">
          <p className="event">{view.meta.name}</p>
          <h1 className="title">검토</h1>
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
          <section className="blk stack">
            <p>
              <b>붙여넣은 대화가 없어요.</b>
            </p>
            <p className="note">대화를 붙여넣지 않았거나, 마지막 수정 후 7일이 지나 지워졌어요.</p>
            <Link className="btn wide" href={`/m/${token}/paste`}>
              대화 붙여넣기
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
