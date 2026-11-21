/** 화면용 숫자 표기 — 담당: C. 금액은 원 단위 정수만 받는다. */

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
