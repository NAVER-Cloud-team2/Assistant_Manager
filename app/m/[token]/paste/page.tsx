import Link from "next/link";
import { PasteFlow } from "@/components/PasteFlow";
import { loadAdminView } from "../../_lib/admin";

/** S2 붙여넣기 — 담당: C. 가림은 lib/mask.ts로 브라우저에서만. */
export const dynamic = "force-dynamic";

/** 사전 고지에 보일 AI 제공사. B의 lib/extract.ts와 같은 규칙: AI_PROVIDER가 "gemini"일 때만 Gemini, 그 밖은 OpenAI */
function aiProviderName(): string {
  return process.env.AI_PROVIDER === "gemini" ? "Google Gemini" : "OpenAI";
}

export default async function PastePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadAdminView(token);

  if (!view) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
        <h1>링크를 찾을 수 없어요</h1>
        <p>관리 링크가 맞지 않거나, 행사가 지워졌어요.</p>
        <Link href="/">새 행사 만들기</Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 48px" }}>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>{view.meta.name}</p>
      <h1 style={{ margin: "4px 0 14px", fontSize: 24 }}>대화 붙여넣기</h1>
      <PasteFlow
        token={token}
        eventId={view.meta.id}
        roster={view.meta.roster}
        hasDraft={view.draft !== null}
        aiProvider={aiProviderName()}
      />
    </main>
  );
}
