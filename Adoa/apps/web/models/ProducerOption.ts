import type { ProducerParamOption } from "./ProducerParamOption";

// An agent the schedule form offers (it has a task producer), with its parameters.
export interface ProducerOption {
  agentId: string;
  label: string;
  description: string;
  params: ProducerParamOption[];
}
