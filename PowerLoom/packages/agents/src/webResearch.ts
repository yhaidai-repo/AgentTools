import { ANY_AGENT, nextItemId, vaultOfPbiSql } from "@powerloom/core";
import { localItem, type PowerLoomDb } from "@powerloom/db";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { DuplicateGuard } from "./DuplicateGuard";
import type { WebResearchDraft } from "./models/WebResearchDraft";

// request_web_research: for an agent without web access (user decision 2026-10-02). The topic becomes a research task
// that needs the web; the agent goes on with what it has. Nothing is written until the run succeeds.
export function createWebResearchTool(requests: WebResearchDraft[], guard: DuplicateGuard): ToolDefinition<any> {
  return defineTool({
    name: "request_web_research",
    description: "You have no web access. When you need facts from the web, call this with the topic instead of guessing; a research task with web access will look it up. Then go on and name the gap in your output.",
    input: {
      topic: z.string().min(1).describe("What to find out, as one question"),
      why: z.string().min(1).describe("What the answer unblocks"),
      sources: z.array(z.string()).default([]).describe("Sites or search terms to try, if you know any"),
    },
    handler: async (input) => {
      const duplicate = guard.check("research", input.topic);

      if (duplicate) {
        return { text: duplicate, isError: true };
      }

      requests.push(input);
      guard.remember("research", `web research ${requests.length}`, input.topic);

      return { text: `Web research ${requests.length} noted: it becomes a research task that needs the web.` };
    },
    replayOnResume: true,
  });
}

// One research task per request, assigned to research and marked `needsWeb`. It keeps the depth of the task that
// asked, so it never counts as a follow-up.
export async function insertWebResearchTasks(db: PowerLoomDb, adoId: number, runId: number, parentId: string | null, depth: number, requests: WebResearchDraft[]): Promise<string[]> {
  const ids: string[] = [];

  for (const request of requests) {
    const id = await nextItemId(db, "AT", adoId);

    await db.insert(localItem).values({
      id, kind: "research", pbiId: adoId, vault: vaultOfPbiSql(adoId), parentId, title: `Web research: ${request.topic}`.slice(0, 120), status: "open", assignee: ANY_AGENT,
      body: request.topic, data: { needsWeb: true, why: request.why, sources: request.sources, depth }, createdByRun: runId,
    });
    ids.push(id);
  }

  return ids;
}
