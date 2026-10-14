import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import type { ServiceBusAnswer } from "@powerloom/azure";
import { z } from "zod";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import type { ServiceBusAccess } from "../models/ServiceBusAccess";
import { defineOutsideTool } from "../outsideAccess";
import { AZURE_ACCESS_INTEGRATION } from "./azureIntegrations";

// An answer's text is cut here so one wide result can't fill the agent's context (as for Read SQL).
const MAX_ANSWER_CHARS = 60_000;

// The Service Bus peek tool (user decision 2026-10-14), part of Azure access next to the server's counts: messages
// are read in place, never received.
export function createServiceBusTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext): ToolDefinition<any>[] {
  const serviceBus = deps.azure?.serviceBus ?? null;
  const isOn = agent.capabilities.integrations?.[AZURE_ACCESS_INTEGRATION] === true && deps.azure?.settings.enabledKinds.azureAccess === true;

  return isOn && serviceBus ? [peekTool(deps, context, serviceBus)] : [];
}

function peekTool(deps: AgentDeps, context: OutsideAccessContext, serviceBus: ServiceBusAccess): ToolDefinition<any> {
  return defineOutsideTool(deps.outside, context, {
    name: "servicebus_peek",
    description: "Peek the next messages of a queue or a topic subscription without receiving them (they stay in place): headers, application properties and the body (JSON when it is JSON), at most 20. Set deadLetter to look at the dead-letter sub-queue. Counts come from servicebus_queue_details and servicebus_topic_subscription_details.",
    input: {
      namespace: z.string().min(1).describe("The namespace host, e.g. aa-dev-sb01.servicebus.windows.net"),
      entity: z.string().min(1).describe("The queue, or the topic when subscription is given"),
      subscription: z.string().optional().describe("The topic's subscription to peek"),
      deadLetter: z.boolean().optional().describe("Peek the dead-letter sub-queue instead (default false)"),
      count: z.number().int().min(1).max(20).optional().describe("Messages to peek, 1–20 (default 5)"),
    },
    resource: (input) => ({ kind: "azure", resource: input.namespace, target: input.namespace }),
    request: (input) => `peek ${input.entity}${input.subscription ? `/${input.subscription}` : ""}${input.deadLetter ? " dead-letter" : ""} ${input.count ?? 5}`,
    handler: async (input) => answerResult(await serviceBus.peeker.peek({ namespace: input.namespace, entity: input.entity, subscription: input.subscription ?? null, deadLetter: input.deadLetter === true, count: input.count ?? 5 })),
  });
}

function answerResult(answer: ServiceBusAnswer): OutsideToolResult {
  if (!answer.ok) {
    return { text: answer.message, isError: true, denied: answer.denied };
  }

  const text = `${answer.messages.length} message(s)\n\n${JSON.stringify(answer.messages, null, 1)}`;
  const cut = text.length > MAX_ANSWER_CHARS ? `\n\n[cut at ${MAX_ANSWER_CHARS} of ${text.length} characters: peek fewer messages]` : "";

  return { text: `${text.slice(0, MAX_ANSWER_CHARS)}${cut}`, rows: answer.messages.length, truncated: cut.length > 0 };
}
