import { Placeholder } from "@/components/Placeholder";

/** S4 정산표 — 담당: C */
export default function TablePage() {
  return (
    <Placeholder
      code="S4"
      title="정산표"
      owner="C"
      todo={[
        "사람별 순결제액·항목별 부담·총부담·잔액 (draft.settlement)",
        "금액을 누르면 항목·참여자·원 발언·정정 발언·총무 확인값 (item.evidence → lines)",
        "나머지 1원 받은 사람 표시 (remainderFrom)",
      ]}
    />
  );
}
