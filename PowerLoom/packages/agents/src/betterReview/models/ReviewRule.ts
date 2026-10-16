// One record of a repo's review rules note, as read at the start of a run.
export interface ReviewRule {
  id: string;
  title: string;
  /** False once the user retired it: `[RESOLVED]` in the heading or a status other than Active. */
  active: boolean;
  /** The record as written, heading included, for the first message. */
  text: string;
}
