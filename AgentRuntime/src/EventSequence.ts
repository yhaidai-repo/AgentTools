import type { AgentEvent } from "./models/AgentEvent";

export type EventBody = AgentEvent extends infer Event ? (Event extends AgentEvent ? Omit<Event, "runId" | "seq" | "at"> : never) : never;

// Stamps run id, sequence number and time, so adapters only describe what happened.
export class EventSequence {
  private seq = 0;

  constructor(private readonly runId: string) {}

  next(body: EventBody): AgentEvent {
    this.seq += 1;

    return { ...body, runId: this.runId, seq: this.seq, at: new Date() } as AgentEvent;
  }
}
