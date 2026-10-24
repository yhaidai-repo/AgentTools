// A peeked message as the agent sees it: the headers that identify and route it, and its body as text or JSON.
export interface ServiceBusMessage {
  sequenceNumber: string;
  messageId: string | null;
  enqueuedTime: string | null;
  subject: string | null;
  contentType: string | null;
  deliveryCount: number | null;
  correlationId: string | null;
  deadLetterReason: string | null;
  applicationProperties: Record<string, unknown>;
  body: unknown;
}
