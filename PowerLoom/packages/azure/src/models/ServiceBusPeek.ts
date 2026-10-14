// What to peek: a queue, or a topic's subscription; its dead-letter sub-queue when `deadLetter`.
export interface ServiceBusPeek {
  /** The namespace host, e.g. aa-dev-sb01.servicebus.windows.net */
  namespace: string;
  /** The queue, or the topic when `subscription` is set. */
  entity: string;
  subscription: string | null;
  deadLetter: boolean;
  count: number;
}
