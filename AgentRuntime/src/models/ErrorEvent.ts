import type { EventBase } from "./EventBase";

export interface ErrorEvent extends EventBase {
  type: "error";
  message: string;
}
