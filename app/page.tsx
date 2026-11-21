import { Placeholder } from "@/components/Placeholder";

/** S1 행사 만들기 — 담당: C */
export default function Home() {
  return (
    <Placeholder
      code="S1"
      title="행사 만들기"
      owner="C"
      todo={[
        "행사 이름, 참여자 명단(순서 고정)과 별칭 입력",
        "POST /api/events → adminToken·resultToken 받기",
        "관리 링크(/m/{adminToken}) 안내: 이 링크로만 다시 들어올 수 있음",
      ]}
    />
  );
}
