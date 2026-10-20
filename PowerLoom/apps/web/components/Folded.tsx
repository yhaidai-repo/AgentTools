"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Matches .folded's max-height.
const FOLDED_HEIGHT_PX = 320;

// Long content shows its first part under a fade with "Show all" (user decision 2026-10-21); short content shows whole.
// The height is watched, so switching a markdown block to its source re-checks it.
export function Folded({ children }: { children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const [isLong, setIsLong] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const element = content.current;

    if (!element) {
      return;
    }

    const measure = () => setIsLong(element.scrollHeight > FOLDED_HEIGHT_PX);
    const observer = new ResizeObserver(measure);

    measure();
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div className={`folded${isOpen ? " open" : ""}${isLong ? " long" : ""}`}>
      <div className="folded-body"><div ref={content}>{children}</div></div>
      {isLong && <button type="button" className="link-button folded-toggle" onClick={() => setIsOpen(!isOpen)}>{isOpen ? "Show less" : "Show all"}</button>}
    </div>
  );
}
