import type { AgentEvent } from "@agenttools/runtime";
import { REPLAY_RUN } from "../resume/replayDraft";

const LAST_TEXTS = 3;
const LAST_WORDS_CHARS = 4_000;

// What the run has used of its turns, counted by the agent's tool calls (close to the runtime's turn count: a turn that
// makes several calls counts each, a turn without a call none), and its latest words, which a run stopped by a limit
// without a result keeps as its partial result. A replay's calls aren't the run's own and don't count.
export class RunMeter {
  private calls = 0;
  private texts: string[] = [];

  observe(event: AgentEvent): void {
    if (event.runId === REPLAY_RUN) {
      return;
    }

    if (event.type === "tool_call") {
      this.calls += 1;
    }

    if (event.type === "text") {
      this.texts = [...this.texts, event.text.trim()].slice(-LAST_TEXTS);
    }
  }

  get toolCalls(): number {
    return this.calls;
  }

  get lastWords(): string {
    return this.texts.join("\n\n").slice(-LAST_WORDS_CHARS);
  }
}
