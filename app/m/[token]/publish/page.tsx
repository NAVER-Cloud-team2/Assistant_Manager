import { Placeholder } from "@/components/Placeholder";

/** S5 확정·발행 — 담당: C */
export default function PublishPage() {
  return (
    <Placeholder
      code="S5"
      title="확정·발행"
      owner="C"
      todo={[
        "“이전에 공유하거나 송금한 사람이 있나요?” 없음·있음·모름",
        "POST /api/events/{id}/publish → version.message의 {{RESULT_URL}}을 실제 결과 링크로 바꿔 복사",
        "2판부터 변동액 표, ‘모두 지우기’ (DELETE /api/events/{id})",
      ]}
    />
  );
}
