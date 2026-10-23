// One review comment as review.get answers it: where it is, what it says (cut short) and how it was answered.
export interface ReviewCommentRead {
  id: string;
  status: string;
  severity: string;
  category: string | null;
  file: string;
  line: number;
  /** The comment's markdown, cut to 2000 characters. */
  text: string;
  answer: string | null;
  agentReply: string | null;
}
