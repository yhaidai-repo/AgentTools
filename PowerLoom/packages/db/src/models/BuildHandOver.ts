import type { HandOverState } from "./HandOverState";

// The hand-over of an implementation: its state, the verification verdict in a line, the pull request's title, and the
// human task that reviews, pushes and opens the pull request (its id once the run handed it over).
export interface BuildHandOver {
  state: HandOverState;
  verdict: string;
  prTitle: string;
  itemId: string | null;
}
