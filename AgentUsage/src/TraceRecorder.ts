import type { StoredTraceEvent } from "./models/StoredTraceEvent";
import type { TraceEntry } from "./models/TraceEntry";
import type { UsageStore } from "./models/UsageStore";

const DEFAULT_MAX_TEXT = 16 * 1024;
const DEFAULT_BATCH = 50;

// Buffers a run's events and writes them in batches; long strings are cut to keep traces bounded.
export class TraceRecorder {
  private buffer: StoredTraceEvent[] = [];

  constructor(
    private readonly store: UsageStore,
    private readonly maxTextLength = DEFAULT_MAX_TEXT,
    private readonly batchSize = DEFAULT_BATCH,
  ) {}

  async record(entry: TraceEntry): Promise<void> {
    const { runId, seq, at, type, ...rest } = entry;

    this.buffer.push({ runId, seq, at, type, payload: truncate(rest, this.maxTextLength) as Record<string, unknown> });

    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    const batch = this.buffer;

    this.buffer = [];

    if (batch.length > 0) {
      await this.store.appendTrace(batch);
    }
  }
}

function truncate(value: unknown, maxLength: number): unknown {
  if (typeof value === "string") {
    return value.length > maxLength ? `${value.slice(0, maxLength)}… [${value.length - maxLength} chars cut]` : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => truncate(item, maxLength));
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, truncate(item, maxLength)]));
  }

  return value;
}
