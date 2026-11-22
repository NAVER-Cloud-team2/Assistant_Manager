/**
 * 첫 화면의 아이폰 틀 — 담당: C
 * 안쪽 화면은 실제 휴대폰 폭(390px)으로 앱과 같은 스타일로 그리고, 틀 크기에 맞춰 통째로 줄인다(zoom).
 * 그래서 첫 화면의 그림이 실제 앱 화면과 똑같이 생겼다. 틀 크기는 부르는 쪽이 --w·--zoom으로 정한다.
 */
import type { ReactNode } from "react";
import s from "./Phone.module.css";

/** 위 상태 막대의 신호·와이파이·배터리 그림 */
export function StatusIcons() {
  return (
    <svg viewBox="0 0 64 14" width="64" height="14" fill="currentColor" aria-hidden="true" focusable="false">
      <rect x="0" y="9" width="3" height="5" rx="1" />
      <rect x="5" y="6.5" width="3" height="7.5" rx="1" />
      <rect x="10" y="4" width="3" height="10" rx="1" />
      <rect x="15" y="1" width="3" height="13" rx="1" />
      <path d="M27.5 4.2a9.6 9.6 0 0 1 13 0l-1.6 1.7a7.3 7.3 0 0 0-9.8 0zM30.4 7.3a5.4 5.4 0 0 1 7.2 0L36 9a3.1 3.1 0 0 0-4 0zM34 12.6l-1.7-1.8a2.4 2.4 0 0 1 3.4 0z" />
      <rect x="44.5" y="1.5" width="17" height="11" rx="3.2" fill="none" stroke="currentColor" strokeOpacity="0.4" />
      <rect x="46.5" y="3.5" width="13" height="7" rx="1.6" />
      <rect x="62.5" y="5" width="1.5" height="4" rx="0.7" fillOpacity="0.4" />
    </svg>
  );
}

export function Phone({
  children,
  className,
  screenClassName,
  lightStatus = false,
}: {
  children: ReactNode;
  className?: string;
  screenClassName?: string;
  /** 맨 위가 색 바탕이면 시각·배터리 표시를 흰 글씨로 */
  lightStatus?: boolean;
}) {
  return (
    <div className={className ? `${s.phone} ${className}` : s.phone}>
      <div className={screenClassName ? `${s.screen} ${screenClassName}` : s.screen}>
        <span className={s.island} aria-hidden="true" />
        <div className={s.content}>
          <div className={lightStatus ? `${s.status} ${s.light}` : s.status} aria-hidden="true">
            <span>9:41</span>
            <StatusIcons />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
