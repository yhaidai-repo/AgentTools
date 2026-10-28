import type { PlanAutoChoice, PlanDecision } from "@powerloom/db";
import { taggedSection } from "./planFileSections";

const DECISION = /^- \*\*(D-\d+):\*\*\s*(.*)$/;
const CONTINUATION = /^\s{2,}\S/;
const AREA = /^## (.+)$/;
const AUTO_CHOICE = /^\*\*User's choice:\*\*\s*\[auto\]\s*(.+)$/;

// The decisions of a phase's CONTEXT.md (`- **D-01:** …` in <decisions>), each with its indented detail lines.
export function contextDecisions(context: string, phase: string): PlanDecision[] {
  const decisions: PlanDecision[] = [];

  for (const line of taggedSection(context, "decisions").split(/\r?\n/)) {
    appendDecisionLine(decisions, line, phase);
  }

  return decisions;
}

// The gray areas discuss --auto settled with its recommended option: `**User's choice:** [auto] …` under each `## area`.
export function autoChoices(discussionLog: string, phase: string): PlanAutoChoice[] {
  const choices: PlanAutoChoice[] = [];
  let area = "";

  for (const line of discussionLog.split(/\r?\n/)) {
    area = AREA.exec(line)?.[1]?.trim() ?? area;
    appendAutoChoice(choices, line, phase, area);
  }

  return choices;
}

function appendDecisionLine(decisions: PlanDecision[], line: string, phase: string): void {
  const decision = DECISION.exec(line);
  const last = decisions.at(-1);

  if (decision) {
    decisions.push({ id: decision[1], phase, text: decision[2].trim() });
    return;
  }

  if (last && CONTINUATION.test(line)) {
    last.text = `${last.text} ${line.trim()}`.trim();
  }
}

function appendAutoChoice(choices: PlanAutoChoice[], line: string, phase: string, area: string): void {
  const choice = AUTO_CHOICE.exec(line.trim());

  if (choice) {
    choices.push({ phase, area, choice: choice[1].trim() });
  }
}
