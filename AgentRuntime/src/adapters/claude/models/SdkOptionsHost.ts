import type { Conversation } from "../../../models/Conversation";
import type { ToolReports } from "../ToolReports";

// What the runtime adds to a request when it builds the SDK options.
export interface SdkOptionsHost {
  /** The folder of a run without its own. */
  projectDir: string;
  conversation: Conversation | undefined;
  apiProxied: boolean;
  /** Where the run's tools report their calls' progress; a run that doesn't read them leaves it out. */
  toolReports?: ToolReports;
}
