import type { reviewComment } from "@powerloom/db";
import Link from "next/link";
import { MarkdownBlock } from "@/components/MarkdownBlock";
import { AnswerForm } from "./AnswerForm";
import { CodeSnippet } from "./CodeSnippet";

type CommentRow = typeof reviewComment.$inferSelect;

const ANSWERABLE = ["open", "answered"];
const SERIOUS = ["blocker", "major"];
const GIST_CHARS = 160;

// One comment (user decision 2026-10-18): a line with how serious, its status, what about and where; open, the comment,
// the code as reviewed, and the thread of the agent's reply and your answer. A settled comment starts folded.
export function CommentCard({ comment }: { comment: CommentRow }) {
  const isAnswerable = ANSWERABLE.includes(comment.status);

  return (
    <details id={comment.id} className={`review-comment${isAnswerable ? " to-answer" : " settled"}`} open={isAnswerable}>
      <summary>
        <span className="fold-mark" aria-hidden="true">›</span>
        <span className={SERIOUS.includes(comment.severity) ? "severity serious" : "severity"}>{comment.severity}</span>
        <span className={`comment-status status-${comment.status}`}>{comment.status}</span>
        {comment.category && <span className="comment-category">{comment.category}</span>}
        <span className="comment-gist">{gistOf(comment.bodyMd)}</span>
        <span className="comment-where">L{comment.startLine}–{comment.endLine} · {comment.commit.slice(0, 8)}{comment.runId && <> · <Link href={`/agents/runs/${comment.runId}`}>RUN-{comment.runId}</Link></>}</span>
      </summary>
      <div className="comment-body">
        <MarkdownBlock text={comment.bodyMd} />
        <CodeSnippet code={comment.codeSnippet} firstLine={comment.snippetStartLine} startLine={comment.startLine} endLine={comment.endLine} />
        <Thread comment={comment} isAnswerable={isAnswerable} />
      </div>
    </details>
  );
}

// The agent's reply, cool; your answer, warm: a field while the comment is open, your words once it is settled.
function Thread({ comment, isAnswerable }: { comment: CommentRow; isAnswerable: boolean }) {
  return (
    <div className="comment-thread">
      {comment.agentReplyMd && <div className="say agent"><b>Agent</b>{comment.agentReplyMd}</div>}
      {isAnswerable && <div className="say you"><b>Your answer</b><AnswerForm commentId={comment.id} answer={comment.answerMd} /></div>}
      {!isAnswerable && comment.answerMd && <div className="say you"><b>You</b>{comment.answerMd}</div>}
    </div>
  );
}

// The comment's first line without its markdown marks, short enough for one line.
export function gistOf(markdown: string): string {
  const firstLine = markdown.split("\n").find((line) => line.trim() !== "") ?? "";
  const plain = firstLine.replace(/[*_`#>]/g, "").trim();

  return plain.length > GIST_CHARS ? `${plain.slice(0, GIST_CHARS)}…` : plain;
}
