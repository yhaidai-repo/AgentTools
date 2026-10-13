import type { AgentEvent } from "@agenttools/runtime";
import type { ReadSource } from "../models/ReadSource";
import { WebReads } from "./WebReads";

const MESSAGE_SOURCE = "S0";

// What one run has read, each under a source id the agent cites as evidence. The result tools check those ids, so a
// claim can only point at something the run actually opened.
export class ReadLog {
  private readonly sources = new Map<string, ReadSource>();

  readonly web = new WebReads();

  constructor(firstMessage: string) {
    this.sources.set(MESSAGE_SOURCE, { id: MESSAGE_SOURCE, text: firstMessage });
  }

  add(text: string): string {
    const id = `S${this.sources.size}`;

    this.sources.set(id, { id, text });

    return id;
  }

  find(id: string): ReadSource | undefined {
    return this.sources.get(id.trim().toUpperCase());
  }

  /** Every agent event of the run; only the SDK's web tools are kept (see WebReads). */
  observe(event: AgentEvent): void {
    this.web.observe(event);
  }
}
