import { AdminMissing } from "@/components/AdminMissing";
import { AdminScreen } from "@/components/AdminScreen";
import { NoDraft } from "@/components/NoDraft";
import { ReviewBoard } from "@/components/ReviewBoard";
import { loadAdminView, loadStepState } from "../_lib/admin";
import { loadConfirm } from "../_lib/confirm";

/** S3 검토 — 담당: C */
export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadAdminView(token);
  if (!view) return <AdminMissing />;

  return (
    <AdminScreen token={token} current="" state={await loadStepState(view)} eventName={view.meta.name} title="검토">
      {view.draft ? (
        <ReviewBoard
          token={token}
          eventId={view.meta.id}
          roster={view.meta.roster}
          initialDraft={view.draft}
          initialConfirm={await loadConfirm(view.meta.id)}
        />
      ) : (
        <NoDraft token={token} />
      )}
    </AdminScreen>
  );
}
