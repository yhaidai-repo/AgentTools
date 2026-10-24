import { getPbiUserNotesCommand } from "@powerloom/core";
import type { UserNotesView } from "@/models/UserNotesView";
import { runWebCommand } from "./commandContext";

export async function loadUserNotes(adoId: number): Promise<UserNotesView> {
  const notes = await runWebCommand(getPbiUserNotesCommand, { adoId });

  return notes.ok ? { text: notes.value.text, problem: null } : { text: null, problem: notes.error };
}
