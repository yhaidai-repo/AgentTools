import { pbiContextBlocks } from "@powerloom/core";
import type { workItem } from "@powerloom/db";
import type { PbiContextSize } from "@/models/PbiContextSize";
import { backlogMount } from "./backlogMount";
import { getDb } from "./db";

type WorkItemRow = typeof workItem.$inferSelect;

// An estimate: about 4 characters per token for English and markdown. A run page shows the real input tokens.
const CHARS_PER_TOKEN = 4;

// The context every agent run and Continue chat on the PBI starts with (pbi.read), measured part by part. References
// an agent reads on top (read_pbi, attachments) aren't counted.
export async function loadPbiContextSize(pbi: WorkItemRow): Promise<PbiContextSize> {
  const blocks = await pbiContextBlocks(getDb(), backlogMount(), pbi);
  const parts = blocks.map((block) => ({ name: block.name, chars: block.text.length, tokens: estimateTokens(block.text.length) }));
  const chars = parts.reduce((sum, part) => sum + part.chars, 0);

  return { chars, tokens: estimateTokens(chars), parts };
}

function estimateTokens(chars: number): number {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}
