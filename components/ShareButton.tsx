"use client";

/**
 * 공유하기 — 담당: C
 * 휴대폰에서는 기기의 공유 창(카카오톡·메시지 등)을 열고, 공유 창이 없는 브라우저에서는 복사한다.
 * text를 주면 그 글을, 아니면 url(없으면 지금 주소)을 공유한다.
 */
import { useState } from "react";
import { IconShare } from "./icons";

export function ShareButton({
  text,
  url,
  title,
  label = "공유하기",
  className = "btn wide",
}: {
  text?: string;
  url?: string;
  title?: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const target = url ?? window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(text ? { text } : { title, url: target });
        return;
      } catch (e) {
        // 사용자가 공유 창을 닫았으면 그대로 둔다
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text ?? target);
      setCopied(true);
    } catch {
      // 복사도 막힌 브라우저: 화면의 글을 직접 길게 눌러 복사한다
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={share}>
        <IconShare />
        {copied ? "복사했어요" : label}
      </button>
      <span className="sr" role="status">
        {copied ? "공유할 글을 복사했어요" : ""}
      </span>
    </>
  );
}
