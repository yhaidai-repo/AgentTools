"use client";

import { Dropdown } from "@/components/Dropdown";

const REFINE_TITLE = "Writes the PBI note from the Vault template and queues a refinement task (also for a PBI already refined)";
const PLAN_TITLE = "Writes the PBI note if it is missing and queues a planning task, which the planning agent takes";

interface StartButtonProps {
  isPending: boolean;
  onRefine: () => void;
  onPlan: () => void;
  /** The PBI page's framed look; the Backlog's selection bar keeps the accent one. */
  secondary?: boolean;
  align?: "left" | "right";
}

// Start as a split button (user request 2026-10-29), on the Backlog's selection bar and the PBI page: the button starts
// refinement as Start always did, its menu starts planning.
export function StartButton({ isPending, onRefine, onPlan, secondary = false, align = "left" }: StartButtonProps) {
  const look = secondary ? "secondary" : undefined;

  return (
    <span className={`split-button${secondary ? " secondary" : ""}`}>
      <button type="button" className={look} onClick={onRefine} disabled={isPending} title={REFINE_TITLE}>{isPending ? "Starting…" : "Start refinement"}</button>
      <Dropdown label="More ways to start" align={align} trigger={null}>
        <button type="button" className="menu-item" role="menuitem" onClick={onPlan} disabled={isPending} title={PLAN_TITLE}><span className="menu-text">Start planning</span></button>
      </Dropdown>
    </span>
  );
}
