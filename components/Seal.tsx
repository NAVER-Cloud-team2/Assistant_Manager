/**
 * 확정 표시 — 담당: C. 톱니 테두리의 빨간 배지 안에 체크와 판 번호를 넣는다. 발행 화면(S5)·결과 페이지(S6)·첫 화면에서 쓴다.
 * 판 번호 글자에는 data-testid="version"이 붙는다 (tests/api-flow.test.ts가 결과 페이지에서 찾는다).
 */
import { useId } from "react";
import s from "./Seal.module.css";

/** 톱니 테두리: 안쪽 점들을 바깥으로 부푼 곡선으로 잇는다 (120 단위 좌표) */
function scallop(n: number, inner: number, outer: number): string {
  const pt = (r: number, a: number) => `${(60 + r * Math.sin(a)).toFixed(2)} ${(60 - r * Math.cos(a)).toFixed(2)}`;
  const step = (Math.PI * 2) / n;
  let d = `M ${pt(inner, 0)}`;
  for (let i = 0; i < n; i++) d += ` Q ${pt(outer, (i + 0.5) * step)} ${pt(inner, (i + 1) * step)}`;
  return `${d} Z`;
}
const EDGE = scallop(18, 52.5, 61.5);

export function Seal({
  version,
  size = 104,
  stamp = false,
  className,
}: {
  version: number;
  size?: number;
  /** 방금 확정한 것처럼 한 번 튀어나오며 체크가 그려진다 */
  stamp?: boolean;
  className?: string;
}) {
  // url(#…)에 쓰는 id라 글자·숫자만 남긴다
  const id = `seal${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg
      className={[s.seal, stamp ? s.stamp : "", className ?? ""].filter(Boolean).join(" ")}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={`${version}판 확정 도장`}
    >
      <defs>
        <linearGradient id={`${id}f`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#ff6b57" />
          <stop offset="1" stopColor="#e0173d" />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={EDGE} fill={`url(#${id}f)`} />
      <path d={EDGE} fill={`url(#${id}g)`} />
      <circle cx="60" cy="60" r="43" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.5" />
      <path className={s.check} data-check d="M47 40.5l8.5 8.5 17-17.5" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="#fff" fontWeight="800" textAnchor="middle">
        <text x="60" y="78" fontSize="25" letterSpacing="-0.5" data-testid="version">{`${version}판`}</text>
        <text x="60" y="95" fontSize="13" fontWeight="700" letterSpacing="2">
          확정
        </text>
      </g>
    </svg>
  );
}
