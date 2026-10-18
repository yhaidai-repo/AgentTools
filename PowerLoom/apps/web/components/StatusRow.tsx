import type { ReactNode } from "react";
import type { Tone } from "@/models/Tone";

const DOT_CLASSES: Record<Tone, string> = { plain: "dot", good: "dot ok", warn: "dot warn", error: "dot error" };

// One row of a status panel: a dot (warnings and errors pulse), the name, the value on the right.
export function StatusRow({ name, value, tone = "plain" }: { name: ReactNode; value?: ReactNode; tone?: Tone }) {
  const rowClass = tone === "warn" || tone === "error" ? `status-row ${tone}` : "status-row";

  return (
    <div className={rowClass}>
      <span className={DOT_CLASSES[tone]} />
      <span className="name">{name}</span>
      {value !== undefined && <span className="value">{value}</span>}
    </div>
  );
}
