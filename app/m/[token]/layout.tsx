import type { Metadata } from "next";

/** 총무 관리 화면 공통 — 검색 노출 차단 */
export const metadata: Metadata = {
  title: "대리총무 · 총무 화면",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
