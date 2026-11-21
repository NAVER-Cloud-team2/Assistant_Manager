import { Placeholder } from "@/components/Placeholder";

/** S2 붙여넣기 — 담당: C. 가림은 lib/mask.ts로 브라우저에서만. */
export default function PastePage() {
  return (
    <Placeholder
      code="S2"
      title="붙여넣기"
      owner="C"
      todo={[
        "사전 고지·동의 (AI 제공사, 보관 기간)",
        "원문 붙여넣기 → listSpeakers → 화자 이름을 명단 별칭에 연결",
        "maskExcerpt로 가림 미리보기 (원문은 서버로 보내지 않음)",
        "POST /api/events/{id}/excerpt 로 가린 줄만 전송",
      ]}
    />
  );
}
