import Link from "next/link";
import { Dropdown } from "@/components/Dropdown";
import type { LinkChoice } from "@/models/LinkChoice";

// A filter that picks one of many (an agent) from the shared dropdown (user, 2026-10-18: no unstyled system lists);
// each choice is a link, so the choice lives in the URL. With a placeholder, the trigger shows it until a choice is made.
export function LinkPicker({ label, value, choices, placeholder }: { label: string; value: string; choices: LinkChoice[]; placeholder?: string }) {
  const current = choices.find((choice) => choice.key === value) ?? (placeholder ? null : choices[0]);

  return (
    <Dropdown label={label} align="right" pill trigger={<span>{current?.label ?? placeholder ?? label}</span>}>
      {choices.map((choice) => (
        <Link key={choice.key} href={choice.href} className={`menu-item${choice.key === value ? " current" : ""}`} role="menuitem">
          <span className="menu-text">{choice.label}</span>
          {choice.key === value && <span className="menu-check" aria-label="current">✓</span>}
        </Link>
      ))}
    </Dropdown>
  );
}
