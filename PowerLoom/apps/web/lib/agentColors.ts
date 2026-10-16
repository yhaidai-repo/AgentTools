// The categorical palette has eight hues (--series-1 … --series-8 in globals.css). An agent's color is its slot in the
// config's order, so it keeps its color whatever the period shows; agents past the palette fold into "Other", never a
// made-up ninth hue.
export const AGENT_COLOR_SLOTS = 8;

export const OTHER_AGENTS_COLOR = "var(--muted)";

export function agentColor(slot: number): string {
  return slot < AGENT_COLOR_SLOTS ? `var(--series-${slot + 1})` : OTHER_AGENTS_COLOR;
}
