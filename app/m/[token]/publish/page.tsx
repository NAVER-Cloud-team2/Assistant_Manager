import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { PublishPanel } from "@/components/PublishPanel";
import { loadAdminView } from "../../_lib/admin";
import { loadLatestVersion } from "../../_lib/versions";

/** S5 확정·발행 — 담당: C */
export const dynamic = "force-dynamic";

export default async function PublishPage({ params }: { params: Promise<{ token: string }> }) {
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
      <AdminNav token={token} current="publish" />
      <header>
        <p className="eyebrow">{view.meta.name}</p>
        <h1>확정·발행</h1>
      </header>
      <PublishPanel
        token={token}
        eventId={view.meta.id}
        hasDraft={view.draft !== null}
        publishable={view.draft?.publishable ?? false}
        latest={await loadLatestVersion(view.meta.id)}
      />
    </main>
  );
}
