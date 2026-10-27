import type { StoredTraceEvent } from "./models/StoredTraceEvent";
import type { TraceEntry } from "./models/TraceEntry";
import type { UsageStore } from "./models/UsageStore";

const DEFAULT_MAX_TEXT = 16 * 1024;
const DEFAULT_BATCH = 50;
const NUL = /\u0000/g;
const NUL_MARK = "␀";
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

// Buffers a run's events and writes them in batches; strings are made storable (see `storableText`).
export class TraceRecorder {
  private buffer: StoredTraceEvent[] = [];

  constructor(
    private readonly store: UsageStore,
    private readonly maxTextLength = DEFAULT_MAX_TEXT,
    private readonly batchSize = DEFAULT_BATCH,
    private readonly reportDroppedBatch: (batch: StoredTraceEvent[], error: unknown) => void = logDroppedBatch,
  ) {}

  async record(entry: TraceEntry): Promise<void> {
    const { runId, seq, at, type, ...rest } = entry;

    this.buffer.push({ runId, seq, at, type, payload: storable(rest, this.maxTextLength) as Record<string, unknown> });

    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    }
  }

  // A run's trace records the run, it isn't part of it: a batch the store rejects is dropped and reported, so a
  // lost trace never fails a run that already spent its budget.
  async flush(): Promise<void> {
    const batch = this.buffer;

    this.buffer = [];

    if (batch.length === 0) {
      return;
    }

    try {
      await this.store.appendTrace(batch);
    } catch (error) {
      this.reportDroppedBatch(batch, error);
    }
  }
}

function logDroppedBatch(batch: StoredTraceEvent[], error: unknown): void {
  console.error(`trace: ${batch.length} event(s) of run ${batch[0].runId} (seq ${batch[0].seq}-${batch[batch.length - 1].seq}) dropped:`, error);
}

function storable(value: unknown, maxLength: number): unknown {
  if (typeof value === "string") {
    return storableText(value, maxLength);
  }

  if (Array.isArray(value)) {
    return value.map((item) => storable(item, maxLength));
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, storable(item, maxLength)]));
  }

  return value;
}

// Postgres jsonb rejects NUL (\u0000, e.g. in a SQL tool's result) and a lone surrogate, so NUL is marked and a long
// string is cut (to keep traces bounded) never between the two halves of a surrogate pair (an emoji).
function storableText(value: string, maxLength: number): string {
  const marked = value.replace(NUL, NUL_MARK).replace(LONE_SURROGATE, "\uFFFD");

  if (marked.length <= maxLength) {
    return marked;
  }

  const end = splitsSurrogatePair(marked, maxLength) ? maxLength - 1 : maxLength;

  return `${marked.slice(0, end)}… [${marked.length - end} chars cut]`;
}

function splitsSurrogatePair(value: string, end: number): boolean {
  const code = value.charCodeAt(end - 1);

  return code >= 0xd800 && code <= 0xdbff;
}
