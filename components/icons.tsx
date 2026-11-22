/** 화면용 아이콘 — 담당: C. 애플 SF Symbols 결로 그린다. 모두 장식이라 보조 기술에서는 숨긴다. 뜻은 옆의 글자나 버튼의 aria-label이 전한다. */
import { type ReactNode, type SVGProps, useId } from "react";

type Props = SVGProps<SVGSVGElement>;

function Icon({ children, ...rest }: Props & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconCheck = (p: Props) => (
  <Icon strokeWidth="2.6" {...p}>
    <path d="M4.5 12.8l4.6 4.6L19.5 6.8" />
  </Icon>
);
export const IconCross = (p: Props) => (
  <Icon strokeWidth="2.4" {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const IconChevron = (p: Props) => (
  <Icon strokeWidth="2.6" {...p}>
    <path d="M9 4.5l7.5 7.5L9 19.5" />
  </Icon>
);
export const IconPlus = (p: Props) => (
  <Icon strokeWidth="2.4" {...p}>
    <path d="M12 4.5v15M4.5 12h15" />
  </Icon>
);
/** AI가 뽑은 값 표시: 반짝이 */
export const IconSparkle = (p: Props) => (
  <Icon fill="currentColor" stroke="none" {...p}>
    <path d="M10 2.5c.5 4.3 2.2 6 6.5 6.5-4.3.5-6 2.2-6.5 6.5-.5-4.3-2.2-6-6.5-6.5 4.3-.5 6-2.2 6.5-6.5z" />
    <path d="M18 13.5c.3 2.4 1.1 3.2 3.5 3.5-2.4.3-3.2 1.1-3.5 3.5-.3-2.4-1.1-3.2-3.5-3.5 2.4-.3 3.2-1.1 3.5-3.5z" />
  </Icon>
);
export const IconLock = (p: Props) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" stroke="none" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Icon>
);
export const IconGlobe = (p: Props) => (
  <Icon strokeWidth="1.8" {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.1-3.6-8.5S9.6 5.8 12 3.5z" />
  </Icon>
);
export const IconClock = (p: Props) => (
  <Icon strokeWidth="1.9" {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);
export const IconWarn = (p: Props) => (
  <Icon fill="currentColor" stroke="none" {...p}>
    <path d="M10.3 3.9a2 2 0 0 1 3.4 0l7.6 13.2A2 2 0 0 1 19.6 20H4.4a2 2 0 0 1-1.7-2.9z" />
    <path d="M12 9v4.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="12" cy="16.6" r="1.25" fill="#fff" />
  </Icon>
);
export const IconCheckCircle = (p: Props) => (
  <Icon fill="currentColor" stroke="none" {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M7.8 12.3l2.9 2.9 5.6-6.2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Icon>
);
/** 지우기: 빨간 원 안의 흰 빼기 */
export const IconMinusCircle = (p: Props) => (
  <Icon fill="currentColor" stroke="none" {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M7 12h10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
  </Icon>
);
/** 순서 바꾸기 손잡이 */
export const IconGrip = (p: Props) => (
  <Icon strokeWidth="1.8" {...p}>
    <path d="M4.5 8h15M4.5 12h15M4.5 16h15" />
  </Icon>
);
export const IconShare = (p: Props) => (
  <Icon strokeWidth="1.9" {...p}>
    <path d="M12 3.5v11M8 7.5l4-4 4 4" />
    <path d="M8 10.5H6.5A1.5 1.5 0 0 0 5 12v7a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-7a1.5 1.5 0 0 0-1.5-1.5H16" />
  </Icon>
);
export const IconCopy = (p: Props) => (
  <Icon strokeWidth="1.9" {...p}>
    <rect x="8.5" y="8.5" width="11" height="12" rx="2.2" />
    <path d="M15.5 5.5v-.3A1.7 1.7 0 0 0 13.8 3.5H6.2A1.7 1.7 0 0 0 4.5 5.2v9.6a1.7 1.7 0 0 0 1.7 1.7h.3" />
  </Icon>
);
export const IconLink = (p: Props) => (
  <Icon strokeWidth="2" {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
  </Icon>
);
export const IconTrash = (p: Props) => (
  <Icon strokeWidth="1.9" {...p}>
    <path d="M4.5 6.5h15M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7M6.5 6.5l.9 12.3c.1 1 .9 1.7 1.9 1.7h5.4c1 0 1.8-.7 1.9-1.7l.9-12.3" />
  </Icon>
);
export const IconClipboard = (p: Props) => (
  <Icon strokeWidth="1.9" {...p}>
    <rect x="5" y="4.5" width="14" height="16" rx="2.5" />
    <path d="M9 4.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5M8.5 10h7M8.5 13.5h7M8.5 17h4" />
  </Icon>
);

/* 탭 막대 */
export const IconTabChat = (p: Props) => (
  <Icon strokeWidth="1.9" {...p}>
    <path d="M12 4C7.3 4 3.5 7.1 3.5 11c0 2 1 3.8 2.6 5.1-.2 1.5-.9 2.8-1.9 3.6 2 0 3.7-.7 4.9-1.7 1 .3 1.9.4 2.9.4 4.7 0 8.5-3.1 8.5-7S16.7 4 12 4z" />
  </Icon>
);
export const IconTabReview = (p: Props) => (
  <Icon strokeWidth="1.9" {...p}>
    <path d="M4 6.5l1.6 1.6L8.5 5M4 12.5l1.6 1.6 2.9-3.1M4 18.5l1.6 1.6 2.9-3.1M11.5 6.5h8.5M11.5 12.5h8.5M11.5 18.5h8.5" />
  </Icon>
);
export const IconTabTable = (p: Props) => (
  <Icon strokeWidth="1.9" {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="3" />
    <path d="M3.5 10h17M8 14.5h3M14 14.5h2.5" />
  </Icon>
);
export const IconTabSend = (p: Props) => (
  <Icon strokeWidth="1.9" {...p}>
    <path d="M20.5 3.5L10.2 13.8M20.5 3.5l-6.3 17-4-6.7-6.7-4z" />
  </Icon>
);

/**
 * 대리총무 앱 아이콘: 둥근 네모 위의 흰 확정 표시.
 * 그라데이션 id가 화면에서 겹치지 않도록 useId로 만든다.
 */
export function AppIcon(p: Props) {
  const id = `app${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false" {...p}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7a45" />
          <stop offset="0.55" stopColor="#ff3b5c" />
          <stop offset="1" stopColor="#d6336c" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id})`} />
      <path
        d="M32 12.5l4.3 3.2 5.3-.6 2.2 4.9 4.9 2.2-.6 5.3 3.2 4.3-3.2 4.3.6 5.3-4.9 2.2-2.2 4.9-5.3-.6L32 51.5l-4.3-3.2-5.3.6-2.2-4.9-4.9-2.2.6-5.3L12.7 32l3.2-4.3-.6-5.3 4.9-2.2 2.2-4.9 5.3.6z"
        fill="#fff"
      />
      <path d="M24.5 32.5l5.2 5.2 10-11" fill="none" stroke="#ff3b5c" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
