"use client";

import { getImageProps } from "next/image";
import { preload } from "react-dom";
import { HEADER_LOGO } from "./LoginScreen";

const BLOCK = "bg-surface-container-high motion-safe:animate-pulse";

/**
 * What the app shows while it works out where a session belongs: the landing
 * page's shape in placeholder blocks. It has no text or images of its own, so
 * nothing branded flashes up before the real screen replaces it. It starts the
 * landing header's logo downloading, so that header can paint with the rest of
 * the page instead of after it.
 */
export default function LoadingScreen() {
  const { props: logo } = getImageProps({ ...HEADER_LOGO, alt: "" });
  preload(logo.src, {
    as: "image",
    imageSrcSet: logo.srcSet,
    imageSizes: logo.sizes,
    fetchPriority: "high",
  });

  return (
    <div role="status" className="min-h-screen overflow-x-clip bg-surface" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div aria-hidden="true">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-2">
            <div className={`h-9 w-9 rounded-full ${BLOCK}`} />
            <div className={`h-5 w-24 rounded-full ${BLOCK}`} />
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden items-center gap-6 sm:flex">
              <div className={`h-3.5 w-12 rounded-full ${BLOCK}`} />
              <div className={`h-3.5 w-24 rounded-full ${BLOCK}`} />
              <div className={`h-3.5 w-8 rounded-full ${BLOCK}`} />
            </div>
            <div className={`h-9 w-24 rounded-full ${BLOCK}`} />
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl items-center gap-6 px-5 pb-16 pt-6 sm:px-8 lg:min-h-[calc(100dvh-5rem)] lg:grid-cols-[1.2fr_1fr] lg:gap-4 lg:pb-24 lg:pt-0">
          <div className="flex flex-col items-start">
            <div className={`h-7 w-44 rounded-full ${BLOCK}`} />
            <div className={`mt-6 h-10 w-[70%] rounded-2xl sm:h-16 lg:h-14 xl:h-16 ${BLOCK}`} />
            <div className={`mt-3 h-10 w-[85%] rounded-2xl sm:h-16 lg:h-14 xl:h-16 ${BLOCK}`} />
            <div className="mt-6 flex w-full max-w-[34rem] flex-col gap-3">
              <div className={`h-4 w-full rounded-full ${BLOCK}`} />
              <div className={`h-4 w-full rounded-full ${BLOCK}`} />
              <div className={`h-4 w-2/3 rounded-full ${BLOCK}`} />
            </div>
            <div className={`mt-8 h-14 w-full max-w-xs rounded-full ${BLOCK}`} />
            <div className={`mt-4 h-4 w-72 max-w-full rounded-full ${BLOCK}`} />
          </div>
          <div
            className={`mx-auto aspect-square w-full max-w-[400px] rounded-full sm:max-w-[480px] lg:max-w-[600px] ${BLOCK}`}
          />
        </div>
      </div>
    </div>
  );
}
