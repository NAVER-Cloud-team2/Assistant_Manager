import { AdminMissing } from "@/components/AdminMissing";
import { AdminScreen } from "@/components/AdminScreen";
import { NoDraft } from "@/components/NoDraft";
import { SettlementView } from "@/components/SettlementView";
import { loadAdminView, loadStepState } from "../../_lib/admin";

/** S4 정산표 — 담당: C */
export const dynamic = "force-dynamic";

export default async function TablePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadAdminView(token);
  if (!view) return <AdminMissing />;

  return (
    <AdminScreen token={token} current="table" state={await loadStepState(view)} eventName={view.meta.name} title="정산">
      {view.draft ? <SettlementView draft={view.draft} eventName={view.meta.name} /> : <NoDraft token={token} />}
    </AdminScreen>
  );
}
