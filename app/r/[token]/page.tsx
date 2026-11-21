import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

/** S6 결과 페이지 — 담당: D. 모임원용, 읽기 전용. 원 발언은 절대 보이지 않는다. */
export const metadata: Metadata = {
  title: "대리총무 · 정산 결과",
  robots: { index: false, follow: false },
};

export default function ResultPage() {
  return (
    <Placeholder
      code="S6"
      title="정산 결과"
      owner="D"
      todo={[
        "GET /api/r/{token} → 별칭·항목·금액·버전만 표시",
        "이름을 누르면 항목별 계산 이유 (people[].lines)",
        "2판이면 ‘1판을 대체하는 2판’과 변동액, 만료일 표시",
      ]}
    />
  );
}
