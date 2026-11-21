/** 화면용 아이콘 — 담당: C. 모두 장식이라 보조 기술에서는 숨긴다. 뜻은 옆의 글자나 버튼의 aria-label이 전한다. */
import type { ReactNode, SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

function Icon({ children, ...rest }: Props & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
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
  <Icon strokeWidth="2.2" {...p}>
    <path d="M2.5 8.6l3.6 3.6 7.4-8.4" />
  </Icon>
);
export const IconCross = (p: Props) => (
  <Icon {...p}>
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
  </Icon>
);
export const IconUp = (p: Props) => (
  <Icon {...p}>
    <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" />
  </Icon>
);
export const IconDown = (p: Props) => (
  <Icon {...p}>
    <path d="M8 3v10M3.5 8.5L8 13l4.5-4.5" />
  </Icon>
);
export const IconChevron = (p: Props) => (
  <Icon {...p}>
    <path d="M6 3.5L10.5 8 6 12.5" />
  </Icon>
);
