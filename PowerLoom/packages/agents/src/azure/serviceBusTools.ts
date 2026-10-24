import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import type { ServiceBusAnswer } from "@powerloom/azure";
import type { AzureResourceSettings } from "@powerloom/core";
import { z } from "zod";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OutsideResource } from "../models/OutsideResource";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import type { ServiceBusAccess } from "../models/ServiceBusAccess";
import { defineOutsideTool } from "../outsideAccess";
import { READ_SERVICE_BUS_INTEGRATION } from "./azureIntegrations";

// An answer's text is cut here so one wide result can't fill the agent's context (as for Read SQL).
const MAX_ANSWER_CHARS = 60_000;

// The Service Bus peek tool (user decision 2026-10-14): the vault's enabled namespaces, each read with its own
// Listen-only connection string from Settings; messages are read in place, never received. Counts stay with Azure
// access (a Listen policy can't read them).
export function createServiceBusTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext): ToolDefinition<any>[] {
  const serviceBus = deps.azure?.serviceBus ?? null;
  const namespaces = deps.azure?.settings.resources.filter((resource) => resource.kind === "serviceBus" && resource.enabled) ?? [];
  const isOn = agent.capabilities.integrations?.[READ_SERVICE_BUS_INTEGRATION] === true && deps.azure?.settings.enabledKinds.serviceBus === true;

  return isOn && serviceBus && namespaces.length > 0 ? [peekTool(deps, context, serviceBus, namespaces)] : [];
}

function peekTool(deps: AgentDeps, context: OutsideAccessContext, serviceBus: ServiceBusAccess, namespaces: AzureResourceSettings[]): ToolDefinition<any> {
  const hosts = namespaces.map((entry) => entry.target) as [string, ...string[]];

  return defineOutsideTool(deps.outside, context, {
    name: "servicebus_peek",
    description: "Peek the next messages of a queue or a topic subscription without receiving them (they stay in place): headers, application properties and the body (JSON when it is JSON), at most 20. Set deadLetter to look at the dead-letter sub-queue.",
    input: {
      namespace: z.enum(hosts).describe(`The namespace: ${namespaces.map(namespaceLabel).join("; ")}`),
      entity: z.string().min(1).describe("The queue, or the topic when subscription is given"),
      subscription: z.string().optional().describe("The topic's subscription to peek"),
      deadLetter: z.boolean().optional().describe("Peek the dead-letter sub-queue instead (default false)"),
      count: z.number().int().min(1).max(20).optional().describe("Messages to peek, 1–20 (default 5)"),
    },
    resource: (input) => resourceOf(input.namespace),
    request: (input) => `peek ${input.entity}${input.subscription ? `/${input.subscription}` : ""}${input.deadLetter ? " dead-letter" : ""} ${input.count ?? 5}`,
    handler: async (input) => {
      const connectionString = namespaces.find((entry) => entry.target === input.namespace)!.secret;
      const peek = { connectionString, entity: input.entity, subscription: input.subscription ?? null, deadLetter: input.deadLetter === true, count: input.count ?? 5 };

      return answerResult(await serviceBus.peeker.peek(peek));
    },
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

function resourceOf(namespace: string): OutsideResource {
  return { kind: "serviceBus", resource: namespace, target: namespace };
}

function namespaceLabel(namespace: AzureResourceSettings): string {
  return `${namespace.target} (${namespace.name})`;
}
