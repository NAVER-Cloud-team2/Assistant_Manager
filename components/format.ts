/** 화면용 숫자·시각 표기 — 담당: C. 금액은 원 단위 정수만 받는다. */

/** 48001 → "48,001원" */
export function won(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 잔액: 25999 → "+25,999원", -22000 → "−22,000원", 0 → "0원" */
export function signedWon(n: number): string {
  if (n > 0) return `+${won(n)}`;
  if (n < 0) return `−${won(-n)}`;
  return won(0);
}

/** 표 안의 금액('단위 원'을 표 머리에 적을 때): 48001 → "48,001" */
export function num(n: number): string {
  return n.toLocaleString("ko-KR");
}

/** 표 안의 잔액: 25999 → "+25,999", -22000 → "−22,000", 0 → "0" */
export function signedNum(n: number): string {
  if (n > 0) return `+${num(n)}`;
  if (n < 0) return `−${num(-n)}`;
  return "0";
}

// 서버와 휴대폰의 시간대가 달라도 같은 글자가 나오도록 한국 시간으로 고정한다
const dateTimeKo = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "long", timeStyle: "short" });

/** ISO 시각 → "2026년 11월 21일 오후 8:29" (한국 시간) */
export function dateTime(iso: string): string {
  return dateTimeKo.format(new Date(iso));
}

/** 화면을 옮길 때 쓸 값. '동작 줄이기'를 켠 기기에서는 바로 옮긴다. 브라우저에서만 부른다. */
export function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
