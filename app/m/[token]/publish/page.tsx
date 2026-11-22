import { AdminMissing } from "@/components/AdminMissing";
import { AdminScreen } from "@/components/AdminScreen";
import { PublishPanel } from "@/components/PublishPanel";
import { loadAdminView, loadStepState } from "../../_lib/admin";
import { loadLatestVersion } from "../../_lib/versions";

/** S5 확정·발행 — 담당: C */
export const dynamic = "force-dynamic";

export default async function PublishPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadAdminView(token);
  if (!view) return <AdminMissing />;

  return (
    <AdminScreen token={token} current="publish" state={await loadStepState(view)} eventName={view.meta.name} title="발행">
      <PublishPanel
        token={token}
        eventId={view.meta.id}
        hasDraft={view.draft !== null}
        publishable={view.draft?.publishable ?? false}
        latest={await loadLatestVersion(view.meta.id)}
      />
    </AdminScreen>
  );
}
