import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StoredTraceEvent } from "../models/StoredTraceEvent";
import type { UsageLabels } from "../models/UsageLabels";
import type { UsageQuery } from "../models/UsageQuery";
import type { UsageRecord } from "../models/UsageRecord";
import type { UsageStore } from "../models/UsageStore";
import type { UsageTotals } from "../models/UsageTotals";
import { inQuery, labelsMatch, totalsOf } from "./aggregate";
import { IncompleteAccountingError } from "../IncompleteAccountingError";

const RECORDS_FILE = "usage.jsonl";
const TRACE_FILE = "trace.jsonl";

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
    const records = (await this.readRecords()).filter((record) => record.startedAt >= from && labelsMatch(record.labels, match));
    if (records.some((record) => record.accountingComplete === false)) throw new IncompleteAccountingError();

    return records
      .reduce((total, record) => total + record.costUsd, 0);
  }

  async totals(query: UsageQuery, groupBy: string): Promise<UsageTotals[]> {
    return totalsOf((await this.readRecords()).filter((record) => inQuery(record, query)), groupBy);
  }

  async records(query: UsageQuery, limit?: number): Promise<UsageRecord[]> {
    const ids = query.runIds === undefined ? null : new Set(query.runIds);
    const matching = (await this.readRecords()).filter((record) => inQuery(record, { ...query, runIds: undefined }) && (ids === null || ids.has(record.runId)));

    matching.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime() || (a.runId < b.runId ? 1 : a.runId > b.runId ? -1 : 0));
    return limit === undefined ? matching : matching.slice(0, limit);
  }

  async trace(runId: string): Promise<StoredTraceEvent[]> {
    const events = await this.readLines<StoredTraceEvent>(TRACE_FILE);

    return events.filter((event) => event.runId === runId).map((event) => ({ ...event, at: new Date(event.at) }));
  }

  async purgeTraceBefore(date: Date): Promise<number> {
    const events = await this.readLines<StoredTraceEvent>(TRACE_FILE);
    const kept = events.filter((event) => new Date(event.at) >= date);

    if (events.length !== kept.length) {
      await writeFile(join(this.folder, TRACE_FILE), kept.map((event) => JSON.stringify(event) + "\n").join(""), "utf8");
    }

    return events.length - kept.length;
  }

  private async readRecords(): Promise<UsageRecord[]> {
    const records = await this.readLines<UsageRecord>(RECORDS_FILE);

    return records.map((record) => ({ ...record, startedAt: new Date(record.startedAt), endedAt: new Date(record.endedAt), subscription: record.subscription ?? [] }));
  }

  private async readLines<T>(file: string): Promise<T[]> {
    const text = await readFile(join(this.folder, file), "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });

    return text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as T);
  }

  private async append(file: string, items: object[]): Promise<void> {
    await mkdir(this.folder, { recursive: true });
    await appendFile(join(this.folder, file), items.map((item) => JSON.stringify(item) + "\n").join(""), "utf8");
  }
}
