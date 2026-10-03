import type { reviewComment } from "@adoa/db";
import Link from "next/link";
import { MarkdownBlock } from "@/components/MarkdownBlock";
import { AnswerForm } from "./AnswerForm";
import { CodeSnippet } from "./CodeSnippet";

type CommentRow = typeof reviewComment.$inferSelect;

const ANSWERABLE = ["open", "answered"];

// One comment: where, how serious, what, the code as reviewed, your answer and the agent's reply to it.
export function CommentCard({ comment }: { comment: CommentRow }) {
  const isClosed = !ANSWERABLE.includes(comment.status);

  return (
    <div id={comment.id} className={isClosed ? "card review-comment closed" : "card review-comment"}>
      <div className="chips">
        <span className="chip">{comment.id}</span>
        <span className={comment.severity === "blocker" || comment.severity === "major" ? "chip result-error" : "chip"}>{comment.severity}</span>
        <span className="chip">{comment.status}</span>
        <span className="muted">lines {comment.startLine}–{comment.endLine} · commit {comment.commit.slice(0, 8)}</span>
        {comment.runId && <Link className="chip" href={`/agents/runs/${comment.runId}`}>RUN-{comment.runId}</Link>}
      </div>
      <MarkdownBlock text={comment.bodyMd} />
      <CodeSnippet code={comment.codeSnippet} firstLine={comment.snippetStartLine} startLine={comment.startLine} endLine={comment.endLine} />
      {comment.agentReplyMd && <p><strong>Agent:</strong> {comment.agentReplyMd}</p>}
      {isClosed ? comment.answerMd && <p><strong>You:</strong> {comment.answerMd}</p> : <AnswerForm commentId={comment.id} answer={comment.answerMd} />}
    </div>
  );
}
