import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StoredTraceEvent } from "../models/StoredTraceEvent";
import type { SubscriptionSnapshot } from "../models/SubscriptionSnapshot";
import type { UsageLabels } from "../models/UsageLabels";
import type { UsageQuery } from "../models/UsageQuery";
import type { UsageRecord } from "../models/UsageRecord";
import type { UsageStore } from "../models/UsageStore";
import type { UsageTotals } from "../models/UsageTotals";
import { inQuery, labelsMatch, totalsOf } from "./aggregate";

const RECORDS_FILE = "usage.jsonl";
const TRACE_FILE = "trace.jsonl";
const SNAPSHOTS_FILE = "subscription.json";

// File store for tools without a database: one JSON object per line. Fine for small volumes.
export class JsonlUsageStore implements UsageStore {
  constructor(private readonly folder: string) {}

  async saveRecord(record: UsageRecord): Promise<void> {
    await this.append(RECORDS_FILE, [record]);
  }

  async appendTrace(events: StoredTraceEvent[]): Promise<void> {
    await this.append(TRACE_FILE, events);
  }

  async costSince(from: Date, match: UsageLabels): Promise<number> {
    const records = await this.readRecords();

    return records
      .filter((record) => record.startedAt >= from && labelsMatch(record.labels, match))
      .reduce((total, record) => total + record.costUsd, 0);
  }

  async totals(query: UsageQuery, groupBy: string): Promise<UsageTotals[]> {
    return totalsOf((await this.readRecords()).filter((record) => inQuery(record, query)), groupBy);
  }

  async records(query: UsageQuery, limit: number): Promise<UsageRecord[]> {
    const matching = (await this.readRecords()).filter((record) => inQuery(record, query));

    return matching.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()).slice(0, limit);
  }

  async trace(runId: string): Promise<StoredTraceEvent[]> {
    const events = await this.readLines<StoredTraceEvent>(TRACE_FILE);

    return events.filter((event) => event.runId === runId).map((event) => ({ ...event, at: new Date(event.at) }));
  }

  async purgeTraceBefore(date: Date): Promise<number> {
    const events = await this.readLines<StoredTraceEvent>(TRACE_FILE);
    const kept = events.filter((event) => new Date(event.at) >= date);

    await writeFile(join(this.folder, TRACE_FILE), kept.map((event) => JSON.stringify(event) + "\n").join(""), "utf8");

    return events.length - kept.length;
  }

  async saveSnapshot(snapshot: SubscriptionSnapshot): Promise<void> {
    const stored = await this.latestSnapshots();
    const previous = stored.find((entry) => entry.provider === snapshot.provider);
    const others = stored.filter((entry) => entry !== previous);

    await mkdir(this.folder, { recursive: true });
    await writeFile(join(this.folder, SNAPSHOTS_FILE), JSON.stringify([...others, keepReading(snapshot, previous)], null, 2), "utf8");
  }

  async latestSnapshots(): Promise<SubscriptionSnapshot[]> {
    const text = await readFile(join(this.folder, SNAPSHOTS_FILE), "utf8").catch(() => "[]");

    return (JSON.parse(text) as SubscriptionSnapshot[]).map((snapshot) => ({ ...snapshot, checkedAt: new Date(snapshot.checkedAt) }));
  }

  private async readRecords(): Promise<UsageRecord[]> {
    const records = await this.readLines<UsageRecord>(RECORDS_FILE);

    return records.map((record) => ({ ...record, startedAt: new Date(record.startedAt), endedAt: new Date(record.endedAt), subscription: record.subscription ?? [] }));
  }

  private async readLines<T>(file: string): Promise<T[]> {
    const text = await readFile(join(this.folder, file), "utf8").catch(() => "");

    return text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as T);
  }

  private async append(file: string, items: object[]): Promise<void> {
    await mkdir(this.folder, { recursive: true });
    await appendFile(join(this.folder, file), items.map((item) => JSON.stringify(item) + "\n").join(""), "utf8");
  }
}

// A report without windows keeps the last reading and only records why.
function keepReading(snapshot: SubscriptionSnapshot, previous: SubscriptionSnapshot | undefined): SubscriptionSnapshot {
  if (snapshot.windows.length > 0 || !previous) {
    return snapshot;
  }

  return { ...previous, plan: snapshot.plan ?? previous.plan, unavailable: snapshot.unavailable };
}
