import type { ServiceBusMessage } from "./ServiceBusMessage";

// A peek's messages, or why it didn't run: `denied` = the namespace refused the connection string (a wrong or
// rotated key, or a policy without Listen).
export type ServiceBusAnswer = { ok: true; messages: ServiceBusMessage[] } | { ok: false; message: string; denied: boolean };
