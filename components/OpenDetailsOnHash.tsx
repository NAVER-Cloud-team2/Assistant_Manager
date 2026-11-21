"use client";

/**
 * 주소의 #이름과 같은 id의 <details>를 열고 그 자리로 옮긴다 — 담당: C
 * S4 정산표에서 '총부담' 금액이나 이름을 누르면(#person-N) 그 사람의 근거 카드가 펼쳐진다.
 */
import { useEffect } from "react";

export function OpenDetailsOnHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
