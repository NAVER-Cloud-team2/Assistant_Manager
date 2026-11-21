import { AdminMissing } from "@/components/AdminMissing";
import { PasteFlow } from "@/components/PasteFlow";
import { StepNav } from "@/components/StepNav";
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
    <main className="page" id="main">
      <StepNav token={token} current="paste" state={await loadStepState(view)} />
      <div className="sheet">
        <header className="blk head">
          <p className="event">{view.meta.name}</p>
          <h1 className="title">대화 붙여넣기</h1>
        </header>
        <PasteFlow
          token={token}
          eventId={view.meta.id}
          roster={view.meta.roster}
          hasDraft={view.draft !== null}
          aiProvider={aiProviderName()}
        />
      </div>
    </main>
  );
}
