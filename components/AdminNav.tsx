import Link from "next/link";

/** 총무 화면 위쪽 이동 메뉴 — 담당: C */
const TABS = [
  { href: "paste", label: "붙여넣기" },
  { href: "", label: "검토" },
  { href: "table", label: "정산표" },
  { href: "publish", label: "발행" },
] as const;

export function AdminNav({ token, current }: { token: string; current: (typeof TABS)[number]["href"] }) {
  return (
    <nav className="admin-nav" aria-label="총무 화면">
      {TABS.map((t) => (
        <Link
          key={t.label}
          href={`/m/${token}${t.href ? `/${t.href}` : ""}`}
          aria-current={t.href === current ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
