import type { UserNotesView } from "@/models/UserNotesView";
import { powerloom, powerloomResult } from "./powerloom";

export async function loadUserNotes(adoId: number): Promise<UserNotesView> {
  const response = await powerloom.GET("/api/pbis/{adoId}/user-notes", { params: { path: { adoId } } });

  if (!response.data) {
    return { text: null, problem: powerloomResult(response, "").message };
  }

  return { text: response.data.text, problem: null };
}
