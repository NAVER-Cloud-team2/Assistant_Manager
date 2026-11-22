import { AdminMissing } from "@/components/AdminMissing";
import { AdminScreen } from "@/components/AdminScreen";
import { PasteFlow } from "@/components/PasteFlow";
import { loadAdminView, loadStepState } from "../../_lib/admin";

/** S2 붙여넣기 — 담당: C. 가림은 lib/mask.ts로 브라우저에서만. */
export const dynamic = "force-dynamic";

/** 사전 고지에 보일 AI 제공사. B의 lib/extract.ts와 같은 규칙: AI_PROVIDER가 "gemini"일 때만 Gemini, 그 밖은 OpenAI */
function aiProviderName(): string {
  return process.env.AI_PROVIDER === "gemini" ? "Google Gemini" : "OpenAI";
}

export default async function PastePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadAdminView(token);
  if (!view) return <AdminMissing />;

  return (
    <AdminScreen token={token} current="paste" state={await loadStepState(view)} eventName={view.meta.name} title="대화 붙여넣기">
      <PasteFlow
        token={token}
        eventId={view.meta.id}
        roster={view.meta.roster}
        hasDraft={view.draft !== null}
        aiProvider={aiProviderName()}
      />
    </AdminScreen>
  );
}
