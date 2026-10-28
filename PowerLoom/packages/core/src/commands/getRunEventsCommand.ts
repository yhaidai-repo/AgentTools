import type { StoredTraceEvent } from "@agenttools/usage";
import { z } from "zod";
import { loadRun } from "../agentRuns/runDetail";
import { TRACE_EVENT_KINDS, traceEventName, traceEventSummary } from "../agentRuns/traceEvents";
import { runRef } from "../agentRuns/vaultRuns";
import type { Command } from "../models/Command";
import { limitInput, vaultInput } from "./inputs";

// A trace line is for reading in a chat: a tool's whole output or a long answer is cut.
const MAX_TEXT_CHARS = 2000;

const input = z.object({
  id: z.number().int().positive().describe("The run's number, e.g. 2716 for RUN-2716"),
  vault: vaultInput,
  kind: z.enum(TRACE_EVENT_KINDS).optional().describe("Only events of this type: phase, text, tool_call, tool_result, usage, result, error, rate_limit, session_start, session_progress, session_end or tool_progress"),
  limit: limitInput(500, 200),
  offset: z.number().int().min(0).default(0).describe("Events to skip, to page through a long trace"),
});

type RunEventsInput = z.infer<typeof input>;

interface TraceEventEntry {
  seq: number;
  at: Date;
  type: string;
  name: string;
  summary: string;
  payload: string;
}

// A run's trace as the run page shows it: every event in order, the texts cut for a chat.
export const getRunEventsCommand: Command<RunEventsInput, { total: number; events: TraceEventEntry[] }> = {
  name: "run.events",
  effect: "read",
  description: "Read a run's trace: its phases, the agent's texts, tool calls and results, usage and errors in order, each with a one-line summary and its payload cut to 2000 chars. Filter by event type; page with limit and offset.",
  input,
  async run(context, input) {
    if (!context.usage) {
      return { ok: false, error: "Run traces aren't available here." };
    }

    const found = await loadRun(context.db, input.id, input.vault);

    if (!found) {
      return { ok: false, error: `${runRef(input.id)} isn't in vault ${input.vault}.` };
    }

    const events = (await context.usage.trace(String(input.id))).filter((event) => !input.kind || event.type === input.kind);
    const page = events.slice(input.offset, input.offset + input.limit);

    return { ok: true, value: { total: events.length, events: page.map(entryOf) } };
  },
};

function entryOf(event: StoredTraceEvent): TraceEventEntry {
  return {
    seq: event.seq,
    at: event.at,
    type: event.type,
    name: traceEventName(event),
    summary: cut(traceEventSummary(event)),
    payload: cut(JSON.stringify(event.payload)),
  };
}

function cut(text: string): string {
  return text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}…` : text;
}
