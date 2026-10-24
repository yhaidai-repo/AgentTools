import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { ConversationStore } from "../../models/ConversationStore";
import type { PastToolCall } from "../../models/PastToolCall";
import { CodexRollouts } from "./CodexRollouts";
import { CodexToolHistory } from "./CodexToolHistory";
import { objectOf } from "./codexWindows";

export class CodexConversations implements ConversationStore {
  private readonly rollouts: CodexRollouts;
  private readonly mapPath: string;
  private mutation: Promise<void> = Promise.resolve();

  constructor(private readonly codexHome: string) {
    this.rollouts = new CodexRollouts(codexHome);
    this.mapPath = join(codexHome, "powerloom-conversations.json");
  }

  async threadOf(id: string): Promise<string | null> {
    return (await this.readMap()).get(id) ?? null;
  }

  async remember(id: string, threadId: string): Promise<void> {
    await this.change(async (map) => { map.set(id, threadId); });
  }

  async exists(id: string): Promise<boolean> {
    const thread = await this.threadOf(id);

    return thread !== null && await this.rollouts.findThread(thread) !== null;
  }

  async toolCalls(id: string): Promise<PastToolCall[]> {
    const thread = await this.threadOf(id);
    const path = thread ? await this.rollouts.findThread(thread) : null;

    if (!path) {
      return [];
    }

    const history = new CodexToolHistory();

    for await (const entry of this.rollouts.entries(path)) {
      history.add(entry);
    }

    return history.results();
  }

  async remove(id: string): Promise<void> {
    await this.change(async (map) => this.removeThread(map, id));
  }

  private async removeThread(map: Map<string, string>, id: string): Promise<void> {
    const thread = map.get(id);

    map.delete(id);

    if (!thread || [...map.values()].includes(thread)) {
      return;
    }

    const path = await this.rollouts.findThread(thread);

    if (path) {
      await rm(path, { force: true });
    }
  }

  private async change(update: (map: Map<string, string>) => Promise<void>): Promise<void> {
    const changing = this.mutation.then(() => this.writeChange(update));

    this.mutation = changing.catch(() => undefined);
    await changing;
  }

  private async writeChange(update: (map: Map<string, string>) => Promise<void>): Promise<void> {
    const map = await this.readMap();

    await update(map);
    await mkdir(this.codexHome, { recursive: true });

    const temporary = this.mapPath + "." + randomUUID() + ".tmp";

    try {
      await writeFile(temporary, JSON.stringify(Object.fromEntries(map)), "utf8");
      await rename(temporary, this.mapPath);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  private async readMap(): Promise<Map<string, string>> {
    try {
      const parsed = objectOf(JSON.parse(await readFile(this.mapPath, "utf8")));
      const entries = Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string");

      return new Map(entries);
    } catch (error) {
      return this.missingMap(error);
    }
  }

  private missingMap(error: unknown): Map<string, string> {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Map();
    }

    throw error;
  }
}
