// The task types the agent form offers: what agents take, what they may create for each other, and the pipeline's.
export interface TaskTypeChoices {
  agent: string[];
  creatable: string[];
  pipeline: string[];
}
