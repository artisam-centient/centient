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
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-2">
            <div className={`h-9 w-9 rounded-full ${BLOCK}`} />
            <div className={`h-5 w-24 rounded-full ${BLOCK}`} />
          </div>
          <div className="flex items-center gap-7">
            <div className="hidden items-center gap-7 md:flex">
              <div className={`h-3.5 w-14 rounded-full ${BLOCK}`} />
              <div className={`h-3.5 w-24 rounded-full ${BLOCK}`} />
              <div className={`h-3.5 w-12 rounded-full ${BLOCK}`} />
              <div className={`h-3.5 w-8 rounded-full ${BLOCK}`} />
            </div>
            <div className={`h-9 w-24 rounded-full ${BLOCK}`} />
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-6 sm:px-8 lg:min-h-[calc(100dvh-4.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:pb-14 lg:pt-2">
          <div className="flex flex-col items-start">
            <div className={`h-12 w-[62%] rounded-2xl sm:h-[4.5rem] lg:h-[4.25rem] xl:h-20 ${BLOCK}`} />
            <div className={`mt-3 h-12 w-[88%] rounded-2xl sm:h-[4.5rem] lg:h-[4.25rem] xl:h-20 ${BLOCK}`} />
            <div className="mt-7 flex w-full max-w-[30rem] flex-col gap-3">
              <div className={`h-4 w-full rounded-full ${BLOCK}`} />
              <div className={`h-4 w-2/3 rounded-full ${BLOCK}`} />
            </div>
            <div className={`mt-9 h-14 w-full max-w-xs rounded-full ${BLOCK}`} />
            <div className={`mt-4 h-4 w-72 max-w-full rounded-full ${BLOCK}`} />
          </div>
          {/* The receipt printer: the owl's perch, the slip, and the slot. */}
          <div className="mx-auto w-full max-w-[34rem]">
            <div className="flex items-end">
              <div className={`mb-1 hidden h-40 w-40 shrink-0 rounded-full sm:block ${BLOCK}`} />
              <div className={`h-[18rem] min-w-0 flex-1 rounded-t-xl sm:h-[20rem] lg:mt-6 lg:h-[38rem] ${BLOCK}`} />
            </div>
            <div className={`-mt-1.5 h-7 rounded-xl ${BLOCK}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
