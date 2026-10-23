// PowerLoom's message queues: what waits, what is scheduled, and the dead letters.
export interface MessagingStatus {
  incoming: number;
  scheduled: number;
  deadLetters: number;
  deadLettersLast24h: number;
  incomingByType: Record<string, number>;
}
