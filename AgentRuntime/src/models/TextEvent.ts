import type { EventBase } from "./EventBase";

export interface TextEvent extends EventBase {
  type: "text";
  text: string;
}
