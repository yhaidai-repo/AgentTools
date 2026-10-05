"use client";

import { useState } from "react";

const COPIED_MS = 1500;

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  }

  return <button type="button" className="secondary" onClick={copy}>{copied ? "Copied" : "Copy"}</button>;
}
