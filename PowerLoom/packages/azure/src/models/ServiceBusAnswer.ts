import type { ServiceBusMessage } from "./ServiceBusMessage";

// A peek's messages, or why it didn't run: `denied` = nobody signed in or the namespace refused the sign-in.
export type ServiceBusAnswer = { ok: true; messages: ServiceBusMessage[] } | { ok: false; message: string; denied: boolean };
