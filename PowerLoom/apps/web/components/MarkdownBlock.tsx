"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Markdown as a page, with its source one click away (user decision 2026-10-02: synced PBIs and agents' texts are
// markdown). Raw HTML in it is shown as text, never run: the content comes from ADO and agents. Links open a new tab.
export function MarkdownBlock({ text }: { text: string }) {
  const [showSource, setShowSource] = useState(false);

  return (
    <div className="markdown-block">
      <button type="button" className="link-button" onClick={() => setShowSource(!showSource)}>{showSource ? "Show formatted" : "Show markdown"}</button>
      {showSource ? <div className="text-block">{text}</div> : <div className="text-block markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: NewTabLink }}>{text}</ReactMarkdown></div>}
    </div>
  );
}

function NewTabLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
}
