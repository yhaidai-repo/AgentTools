import type { AgentEvent } from "@agenttools/runtime";
import type { ReadSource } from "../models/ReadSource";
import { WebReads } from "./WebReads";

const MESSAGE_SOURCE = "S0";

// What one run has read, each under a source id the agent cites as evidence. The result tools check those ids, so a
// claim can only point at something the run actually opened.
export class ReadLog {
  private readonly sources = new Map<string, ReadSource>();
  private nextNumber = 1;

  readonly web = new WebReads();

  constructor(firstMessage: string) {
    this.sources.set(MESSAGE_SOURCE, { id: MESSAGE_SOURCE, text: firstMessage });
  }

  add(text: string, metadata: Partial<ReadSource> = {}): string {
    const id = `S${this.nextNumber}`;

    this.restore(id, text, metadata);

    return id;
  }

  /** A source read earlier in a continued conversation, under the id the agent saw then; later reads number on after
   *  the highest, since a read cut off by a restart can leave a gap. */
  restore(id: string, text: string, metadata: Partial<ReadSource> = {}): void {
    this.sources.set(id, { ...metadata, id, text });
    this.nextNumber = Math.max(this.nextNumber, Number(id.slice(1)) + 1);
  }

  find(id: string): ReadSource | undefined {
    return this.sources.get(id.trim().toUpperCase());
  }

  /** Every agent event of the run; only the SDK's web tools are kept (see WebReads). */
  observe(event: AgentEvent): void {
    this.web.observe(event);
  }
}
