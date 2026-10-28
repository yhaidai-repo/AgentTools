import type { Conversation } from "../../../models/Conversation";

// What the runtime adds to a request when it builds the SDK options.
export interface SdkOptionsHost {
  /** The folder of a run without its own. */
  projectDir: string;
  conversation: Conversation | undefined;
  apiProxied: boolean;
}
