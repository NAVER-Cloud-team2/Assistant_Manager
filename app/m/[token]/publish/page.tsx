import { AdminMissing } from "@/components/AdminMissing";
import { PublishPanel } from "@/components/PublishPanel";
import { StepNav } from "@/components/StepNav";
import { loadAdminView, loadStepState } from "../../_lib/admin";
import { loadLatestVersion } from "../../_lib/versions";

/** S5 확정·발행 — 담당: C */
export const dynamic = "force-dynamic";

export default async function PublishPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadAdminView(token);
  if (!view) return <AdminMissing />;

  return (
    <main className="page" id="main">
      <StepNav token={token} current="publish" state={await loadStepState(view)} />
      <div className="sheet">
        <header className="blk head">
          <p className="event">{view.meta.name}</p>
          <h1 className="title">확정·발행</h1>
        </header>
        <PublishPanel
          token={token}
          eventId={view.meta.id}
          hasDraft={view.draft !== null}
          publishable={view.draft?.publishable ?? false}
          latest={await loadLatestVersion(view.meta.id)}
        />
      </div>
    </main>
  );
}
