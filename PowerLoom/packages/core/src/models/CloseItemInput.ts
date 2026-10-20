import type { CloseItemRequest } from "./CloseItemRequest";

// What a caller of item.close sends: the close request plus, for a structured human task, one answer per step (an
// empty string skips a step). The command renders the answers and the note into the item's resolution.
export interface CloseItemInput extends CloseItemRequest {
  answers: string[];
}
