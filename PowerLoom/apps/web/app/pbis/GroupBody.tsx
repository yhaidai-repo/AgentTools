"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface Fold {
  folded: boolean;
  toggle: () => void;
}

const FoldContext = createContext<Fold>({ folded: false, toggle: () => undefined });

// One PBI and its child items (user decision 2026-10-09): the fold is the browser's state, so the Live refresh never
// undoes it. A done or closed PBI's children start folded (user decision 2026-10-18).
export function GroupBody({ startFolded, children }: { startFolded: boolean; children: ReactNode }) {
  const [folded, setFolded] = useState(startFolded);

  return (
    <FoldContext.Provider value={{ folded, toggle: () => setFolded(!folded) }}>
      <tbody className="pbi-group" data-folded={folded ? "" : undefined}>{children}</tbody>
    </FoldContext.Provider>
  );
}

// The fold button at the start of a parent row, with its child count.
export function ChildToggle({ count }: { count: number }) {
  const { folded, toggle } = useContext(FoldContext);

  return (
    <button type="button" className={`fold-button${folded ? "" : " open"}`} onClick={toggle} aria-expanded={!folded} aria-label={`${folded ? "Show" : "Hide"} ${count} child item${count === 1 ? "" : "s"}`}>
      <span aria-hidden="true">▸</span>{count}
    </button>
  );
}
