import type { AgentEvent } from "@agenttools/runtime";

type ToolCall = Extract<AgentEvent, { type: "tool_call" }>;

// WebSearch and WebFetch are the SDK's own tools, so their results can't carry a source id; evidence cites them as
// source "web" with the page's URL, and this keeps what each call asked for and returned to check that against.
// PowerLoom's own web tools have source ids, but a "web" + URL citation of what they returned holds too.
const WEB_TOOLS = ["WebSearch", "WebFetch", "search_web", "read_web_page"];

export class WebReads {
  private readonly pending = new Map<string, ToolCall>();
  private readonly texts: string[] = [];

  observe(event: AgentEvent): void {
    if (event.type === "tool_call" && WEB_TOOLS.includes(event.name)) {
      this.pending.set(event.callId, event);
    }

    if (event.type === "tool_result") {
      this.finish(event.callId, event.output, event.isError);
    }
  }

  /** The text of every web call that mentions the URL (in what it asked or what it returned). */
  textsWith(url: string): string[] {
    const wanted = normalizedUrl(url);

    return this.texts.filter((text) => text.toLowerCase().includes(wanted));
  }

  private finish(callId: string, output: string, isError: boolean): void {
    const call = this.pending.get(callId);

    if (!call) {
      return;
    }

    this.pending.delete(callId);

    if (!isError) {
      this.texts.push(`${JSON.stringify(call.input)}\n${output}`);
    }
  }
}

function normalizedUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}
