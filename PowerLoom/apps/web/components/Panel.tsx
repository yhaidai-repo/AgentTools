import type { ReactNode } from "react";
import { toneClass } from "@/lib/tone";
import type { Tone } from "@/models/Tone";

interface PanelProps {
  title?: ReactNode;
  /** Beside the title on the right: a hint or a switch. */
  aside?: ReactNode;
  tone?: Tone;
  /** A table panel: scrolls sideways when narrow, the content goes edge to edge. */
  table?: boolean;
  children: ReactNode;
}

// A glowing card with a title (the dashboard's panels): a light travels its border on hover; a warning or an error
// breathes its outline.
export function Panel({ title, aside, tone = "plain", table = false, children }: PanelProps) {
  return (
    <section className={`panel${toneClass(tone)}`}>
      {title && <h3>{title}{aside}</h3>}
      {table ? <div className="panel-scroll">{children}</div> : <div className="panel-body">{children}</div>}
    </section>
  );
}
