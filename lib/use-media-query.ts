"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether `query` matches, kept in step with the viewport. False on the server,
 * in static renders and where matchMedia is missing (jsdom), so markup
 * rendered without a real window takes the wide layout.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => false,
  );
}

/** From 1024px the task's session panel sits beside it and answers are accepted in place. */
export const DESKTOP_QUERY = "(min-width: 1024px)";
/** Under 768px the two responses are read one at a time. */
export const PHONE_QUERY = "(max-width: 767px)";
