"use client";

import { useEffect, type RefObject } from "react";

/**
 * How far a section is through its camera move, from 0 to 1.
 *
 * - "exit": 0 while the element's top is at or below the top of the viewport,
 *   1 once it has scrolled fully out above it. The hero uses this: the camera
 *   pulls back and tilts as the visitor scrolls on.
 * - "enter": 0 while the element's top is at the bottom of the viewport, 1 once
 *   its top reaches 30% from the top. A section uses this to settle into view.
 */
export type CameraMode = "exit" | "enter";

function progress(el: HTMLElement, mode: CameraMode): number {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const p = mode === "exit" ? -r.top / Math.max(1, r.height) : (vh - r.top) / Math.max(1, vh * 0.7);
  return Math.min(1, Math.max(0, p));
}

/**
 * Writes the element's camera progress to its `--cam` custom property on every
 * frame it scrolls, while it is near the viewport. CSS reads `--cam` to move
 * the camera, so the transforms stay in the stylesheet and off the main thread
 * once set. With reduced motion it writes nothing and `--cam` keeps its resting
 * value from the CSS.
 */
export function useScrollCamera(ref: RefObject<HTMLElement | null>, mode: CameraMode) {
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let near = false;
    const write = () => {
      raf = 0;
      el.style.setProperty("--cam", progress(el, mode).toFixed(4));
    };
    const onScroll = () => {
      if (near && !raf) raf = requestAnimationFrame(write);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        near = entry.isIntersecting;
        if (near) write();
      },
      { rootMargin: "25% 0px 25% 0px" },
    );
    io.observe(el);
    write();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref, mode]);
}
