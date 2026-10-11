import { powerloom } from "./powerloom";

export interface DeadLetter {
  id: string;
  messageType: string;
  exceptionType: string | null;
  exceptionMessage: string | null;
  sentAt: Date;
  source: string | null;
  replayable: boolean;
}

// Messages PowerLoom gave up on (Wolverine's dead letters): the errors outside a single run, never hidden.
export async function loadDeadLetters(from: Date): Promise<DeadLetter[]> {
  const { data } = await powerloom.GET("/api/dead-letters", { params: { query: { since: from.toISOString() } } });

  return (data ?? []).map((letter) => ({ ...letter, exceptionType: letter.exceptionType ?? null, exceptionMessage: letter.exceptionMessage ?? null, source: letter.source ?? null, sentAt: new Date(letter.sentAt) }));
}
