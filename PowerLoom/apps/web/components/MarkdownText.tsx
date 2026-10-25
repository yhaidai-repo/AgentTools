import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { readableMarkdown } from "@/lib/readableText";

// A short agent-written field (a human task's why, a step's action) as formatted markdown, without MarkdownBlock's source
// toggle. Raw HTML in it is shown as text, never run. Links to other sites open a new tab.
export function MarkdownText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`text-block markdown markdown-text${className ? ` ${className}` : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: TextLink }}>{readableMarkdown(text)}</ReactMarkdown>
    </div>
  );
}

function TextLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  return href?.startsWith("/") ? <a href={href}>{children}</a> : <a href={href} target="_blank" rel="noreferrer">{children}</a>;
}
