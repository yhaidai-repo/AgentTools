export interface QuestionDraft {
  question: string;
  why: string;
  options: string[];
  /** The linked document this question asks for; an upload answering it provides that URL's content. */
  url?: string;
}
