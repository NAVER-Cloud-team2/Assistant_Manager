"use client";

/**
 * 스크롤에 맞춰 찍히는 도장 — 담당: C. 첫 화면(S1)의 스크롤 장면에서만 쓴다.
 * 기본은 SVG 도장(components/Seal)이다. load()를 부르면 three.js 셰이더를 내려받아 인주가 번지는 도장으로 바꾼다.
 * WebGL이 없거나 내려받기에 실패하면 SVG 도장이 그대로 남는다.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import s from "./InkSeal.module.css";
import type { InkSealGl } from "./inkSealGl";
import { Seal } from "./Seal";

export interface InkSealHandle {
  /** 찍힌 정도: 0 = 아직 안 찍힘, 1 = 다 찍힘 */
  set(progress: number): void;
  /** 셰이더 도장 준비를 시작한다. 여러 번 불러도 한 번만 한다 */
  load(): void;
}

export const InkSeal = forwardRef<InkSealHandle, { version: number; size?: number; className?: string }>(function InkSeal(
  { version, size = 104, className },
  ref,
) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const gl = useRef<InkSealGl | null>(null);
  const progress = useRef(1);
  const started = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      set(p) {
        progress.current = p;
        if (gl.current) gl.current.render(p);
        else wrap.current?.style.setProperty("--ink", String(p));
      },
      load() {
        const host = wrap.current;
        if (started.current || !host || !canvas.current) return;
        started.current = true;
        const backToSvg = () => {
          gl.current = null;
          host.classList.remove(s.ready);
          host.style.setProperty("--ink", String(progress.current));
        };
        import("./inkSealGl")
          .then((m) => m.createInkSeal(canvas.current!, host, version, backToSvg))
          .then((made) => {
            if (!made) return;
            gl.current = made;
            host.classList.add(s.ready);
            made.render(progress.current);
          })
          .catch(() => {
            // 내려받기 실패: SVG 도장 그대로
          });
      },
    }),
    [version],
  );

  useEffect(
    () => () => {
      gl.current?.dispose();
      gl.current = null;
    },
    [],
  );

  return (
    <div className={[s.wrap, className ?? ""].filter(Boolean).join(" ")} ref={wrap} style={{ width: size, height: size }}>
      <Seal version={version} size={size} className={s.fallback} />
      <canvas ref={canvas} className={s.canvas} aria-hidden="true" />
    </div>
  );
});
