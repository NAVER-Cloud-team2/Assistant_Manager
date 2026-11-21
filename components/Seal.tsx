/**
 * 확정 도장 — 담당: C. 가운데에 판 번호를 찍는다. 발행 화면(S5)과 결과 페이지(S6)에서 쓴다.
 * 판 번호 글자에는 data-testid="version"이 붙는다 (tests/api-flow.test.ts가 결과 페이지에서 찾는다).
 */
import { useId } from "react";
import s from "./Seal.module.css";

export function Seal({
  version,
  size = 104,
  stamp = false,
  className,
}: {
  version: number;
  size?: number;
  /** 방금 찍힌 것처럼 한 번 움직인다 */
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
        <path id={`${id}t`} d="M 27 60 A 33 33 0 0 1 93 60" />
        <path id={`${id}b`} d="M 17 60 A 43 43 0 0 0 103 60" />
        <filter id={`${id}i`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" />
        </filter>
      </defs>
      <g filter={`url(#${id}i)`} fill="none" stroke="currentColor">
        <circle cx="60" cy="60" r="55" strokeWidth="4" />
        <circle cx="60" cy="60" r="48.5" strokeWidth="1.4" />
        <path d="M13 45h94M13 77h94" strokeWidth="1.8" />
      </g>
      <g filter={`url(#${id}i)`} fill="currentColor" fontWeight="700" textAnchor="middle">
        <text fontSize="12.5" letterSpacing="2">
          <textPath href={`#${id}t`} startOffset="50%">
            대리총무
          </textPath>
        </text>
        <text x="60" y="69.5" fontSize="23" data-testid="version">{`${version}판`}</text>
        <text fontSize="12.5" letterSpacing="6">
          <textPath href={`#${id}b`} startOffset="50%">
            확정
          </textPath>
        </text>
      </g>
    </svg>
  );
}
