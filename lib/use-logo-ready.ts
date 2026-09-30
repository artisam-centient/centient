"use client";

import { useCallback, useState } from "react";

/**
 * Whether a logo can paint yet, for holding back the text beside it. The text
 * is in the HTML while the logo is a separate request, so left alone the text
 * shows first and the logo pops in next to it. Spread `onLoad`/`onError` onto
 * the `next/image` logo: its `onLoad` fires once the image has decoded, even
 * when it finished loading before hydration.
 */
export function useLogoReady() {
  const [ready, setReady] = useState(false);
  // Settles on an error too: a logo that never arrives must not hide the brand.
  const settle = useCallback(() => setReady(true), []);
  return { ready, onLoad: settle, onError: settle };
}
