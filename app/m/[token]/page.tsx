import { Placeholder } from "@/components/Placeholder";

/** S3 검토 — 담당: C */
export default function ReviewPage() {
  return (
    <Placeholder
      code="S3"
      title="검토"
      owner="C"
      todo={[
        "GET /api/events/{id}/draft (헤더 x-admin-token)",
        "줄 번호 붙은 발언을 ‘확정 후보 / 확인 필요 / 정산 외’로 표시",
        "aiDraft면 ‘AI 추출 초안’ 표시, aiFailed면 직접 입력 안내",
        "질문 카드(Q-대상·Q-분리·Q-환불·Q-중복), 직접 항목 추가 → POST /answers",
      ]}
    />
  );
}
