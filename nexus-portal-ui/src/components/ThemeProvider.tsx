"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Send the admin session cookie with every API call. Auth lives in the httpOnly cookie, so no
// token is read from or written to browser storage.
if (typeof window !== "undefined" && !window.__nexus_fetch_intercepted) {
  window.__nexus_fetch_intercepted = true;
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("/api/") && !(init && init.credentials)) {
      init = { ...(init || {}), credentials: "include" };
    }
    return originalFetch.call(this, input, init);
  };
}

declare global {
  interface Window {
    __nexus_fetch_intercepted?: boolean;
  }
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
