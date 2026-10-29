"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { actionsInFlight, installActivityTracking, subscribeToActions } from "@/lib/activityTracker";

const NAVIGATION_TIMEOUT_MS = 15000;

// A thin line at the top of the window while the server works: after a click on a link until the new page is there, and
// while a server action runs. The button that started an action shows its own spinner (see [data-busy] in shell.css).
export function ActivityBar() {
  return (
    <Suspense fallback={null}>
      <ActivityLine />
    </Suspense>
  );
}

function ActivityLine() {
  const isNavigating = useNavigationStarted();
  const isActing = useSyncExternalStore(subscribeToActions, () => actionsInFlight() > 0, () => false);

  useEffect(installActivityTracking, []);

  return isNavigating || isActing ? <div className="activity-bar" role="progressbar" aria-label="Loading" /> : null;
}

// True from the click on an internal link until the address (path or query) has changed, or the wait ran out.
function useNavigationStarted(): boolean {
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();
  const query = useSearchParams().toString();

  useEffect(() => setIsNavigating(false), [pathname, query]);
  useEffect(() => listenForLinkClicks(() => setIsNavigating(true)), []);
  useEffect(() => stopAfterTimeout(isNavigating, () => setIsNavigating(false)), [isNavigating]);

  return isNavigating;
}

function listenForLinkClicks(onNavigate: () => void): () => void {
  const onClick = (event: MouseEvent) => {
    if (opensAnotherPage(event)) {
      onNavigate();
    }
  };

  document.addEventListener("click", onClick);

  return () => document.removeEventListener("click", onClick);
}

function stopAfterTimeout(isNavigating: boolean, stop: () => void): (() => void) | undefined {
  if (!isNavigating) {
    return undefined;
  }

  const timer = setTimeout(stop, NAVIGATION_TIMEOUT_MS);

  return () => clearTimeout(timer);
}

function opensAnotherPage(event: MouseEvent): boolean {
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;

  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  return isOtherPageOfThisSite(link as HTMLAnchorElement);
}

function isOtherPageOfThisSite(link: HTMLAnchorElement): boolean {
  const isSameTab = !link.target || link.target === "_self";
  const target = new URL(link.href, window.location.href);

  return isSameTab && !link.hasAttribute("download") && target.origin === window.location.origin && target.pathname + target.search !== window.location.pathname + window.location.search;
}
