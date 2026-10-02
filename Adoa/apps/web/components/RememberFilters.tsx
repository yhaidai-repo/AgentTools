"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { COOKIE_MAX_AGE_SECONDS, SHARED_FILTERS, pageFilterCookie, sharedFilterCookie } from "@/lib/sharedFilters";

// Filters live in the URL; this remembers a page's last ones (user decision 2026-10-02) in cookies, which the page reads
// on the server (rememberedParams) when the URL has none, e.g. via the menu or a back link. The shared ones (the period)
// are one value for every page that has them.
export function RememberFilters() {
  return (
    <Suspense fallback={null}>
      <FilterMemory />
    </Suspense>
  );
}

function FilterMemory() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    if (!search) {
      return;
    }

    const current = new URLSearchParams(search);

    writeCookie(pageFilterCookie(pathname), search);
    SHARED_FILTERS.filter((name) => current.has(name)).forEach((name) => writeCookie(sharedFilterCookie(name), current.get(name)!));
  }, [pathname, search]);

  return null;
}

function writeCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}
