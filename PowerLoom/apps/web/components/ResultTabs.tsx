"use client";

import { useState, type ReactNode } from "react";

export interface ResultTab {
  key: string;
  label: string;
  content: ReactNode;
}

// Several results of one task or PBI (reports, research results) as tabs, the newest open first (user request
// 2026-10-20): the content is rendered by the server; only the choice lives here.
export function ResultTabs({ tabs, initial }: { tabs: ResultTab[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[tabs.length - 1]?.key ?? "");
  const current = tabs.find((tab) => tab.key === active) ?? tabs[tabs.length - 1];

  if (tabs.length === 0) {
    return null;
  }

  return (
    <>
      <nav className="tabs">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" className={tab.key === current?.key ? "active" : undefined} onClick={() => setActive(tab.key)}>{tab.label}</button>
        ))}
      </nav>
      {current?.content}
    </>
  );
}
