// The fields every assistant, user and tool_progress frame shares that say which sub-session sent it: a sub-agent's
// frames carry its starting call's id and, on assistant and user frames, its type and task description.
export interface SdkSubSessionFrame {
  parent_tool_use_id: string | null;
  subagent_type?: string;
  task_description?: string;
}
