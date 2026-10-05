import { TASK_PRODUCERS, type ProducerParamSpec, type TaskProducer } from "@adoa/core";
import type { ProducerOption } from "@/models/ProducerOption";
import type { ProducerParamOption } from "@/models/ProducerParamOption";
import type { ScheduleFormValues } from "@/models/ScheduleFormValues";
import { getAgentConfig } from "./agentConfig";

const DEFAULT_CRON = "0 */6 * * *";

// The agents that can be scheduled (those with a task producer), with their labels and parameters' offered values.
export async function producerOptions(): Promise<ProducerOption[]> {
  return Promise.all(TASK_PRODUCERS.map(producerOption));
}

export function newScheduleValues(producers: ProducerOption[]): ScheduleFormValues {
  const first = producers[0];
  const params = Object.fromEntries((first?.params ?? []).map((param) => [param.key, param.defaultValue]));

  return { id: null, name: first ? `${first.label} schedule` : "", agentId: first?.agentId ?? "", cron: DEFAULT_CRON, enabled: true, params };
}


async function producerOption(producer: TaskProducer): Promise<ProducerOption> {
  const agent = await getAgentConfig().get(producer.agentId);

  return { agentId: producer.agentId, label: agent?.label ?? producer.agentId, description: producer.description, params: await Promise.all(producer.params.map(paramOption)) };
}

async function paramOption(spec: ProducerParamSpec): Promise<ProducerParamOption> {
  return { key: spec.key, label: spec.label, description: spec.description, choices: await spec.choices(), defaultValue: spec.defaultValue };
}
