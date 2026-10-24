// A message PowerLoom gave up on (Wolverine's dead letters): an error outside a single run, never hidden.
export interface DeadLetter {
  id: string;
  messageType: string;
  exceptionType: string | null;
  exceptionMessage: string | null;
  sentAt: Date;
  source: string | null;
  replayable: boolean;
}
