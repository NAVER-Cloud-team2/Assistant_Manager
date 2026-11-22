"use client";

/**
 * 아래에서 올라오는 시트 — 담당: C
 * <dialog>로 띄워서 뒤 화면은 눌리지 않고, Esc나 어두운 바깥을 누르면 닫힌다. 넓은 화면에서는 가운데 뜬 카드가 된다.
 * Sheet: 열고 닫기를 부르는 쪽이 정한다. SheetButton: 칸을 누르면 스스로 열린다(서버에서 그린 내용을 그대로 받아 보여 준다).
 */
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import s from "./Sheet.module.css";

export function Sheet({
  open,
  onClose,
  title,
  children,
  leading,
  trailing,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** 머리 왼쪽. 없으면 '닫기' */
  leading?: ReactNode;
  /** 머리 오른쪽 (예: '추가') */
  trailing?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={s.sheet}
      aria-labelledby={titleId}
      onClose={onClose}
      // 어두운 바깥을 누르면 dialog 자신이 눌린다 (안쪽 내용은 .inner가 다 덮는다)
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={s.inner}>
        <span className={s.grabber} aria-hidden="true" />
        <header className={s.head}>
          <div className={s.lead}>
            {leading ?? (
              <button type="button" className="link" onClick={onClose}>
                닫기
              </button>
            )}
          </div>
          <h2 className={s.title} id={titleId}>
            {title}
          </h2>
          <div className={s.trail}>{trailing}</div>
        </header>
        <div className={s.body}>{children}</div>
      </div>
    </dialog>
  );
}

/**
 * 누르면 시트가 열리는 칸. 주소가 #id이면 처음부터 열어 둔다 (정산 화면의 #person-0 같은 링크).
 * trigger 안에는 <span>만 쓴다 (버튼 안에 블록 요소를 넣지 않는다).
 */
export function SheetButton({
  id,
  title,
  trigger,
  children,
  className = "cell tap",
}: {
  id?: string;
  title: ReactNode;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const check = () => {
      if (decodeURIComponent(window.location.hash.slice(1)) === id) setOpen(true);
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [id]);

  return (
    <>
      <button type="button" id={id} className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {trigger}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        {children}
      </Sheet>
    </>
  );
}
