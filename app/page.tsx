import { CreateEventForm } from "@/components/CreateEventForm";

/** S1 행사 만들기 — 담당: C */
export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 48px" }}>
      <p style={{ margin: 0, color: "var(--accent)", fontWeight: 600 }}>대리총무</p>
      <h1 style={{ margin: "4px 0 6px", fontSize: 26 }}>정산할 모임 만들기</h1>
      <p style={{ margin: "0 0 24px", color: "var(--muted)" }}>
        단톡 대화를 붙여넣으면 근거가 붙은 정산표를 만들어 드려요. 가입은 필요 없어요.
      </p>
      <CreateEventForm />
    </main>
  );
}
