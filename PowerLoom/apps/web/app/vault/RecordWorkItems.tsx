import Link from "next/link";
import React from "react";
import type { RecordWorkReference } from "@powerloom/vault";

export function RecordWorkItems({ references }: { references?: RecordWorkReference[] }) {
  if (!references?.length) return null;
  return <div className="row-facts">{references.map((reference, index) => (
    <span key={index}>
      {reference.action === "created" ? "Created in" : "Updated in"}{reference.date ? ` (${reference.date})` : ""}: {" "}
      {reference.pbiId && <><Link href={`/pbis/${reference.pbiId}`}>PBI-{reference.pbiId}</Link>{" "}</>}
      {reference.taskId && <><Link href={`/tasks/${encodeURIComponent(reference.taskId)}`}>{reference.taskId}</Link>{" "}</>}
      {reference.chatId ? <span title={reference.chatId}>Chat {reference.chatId}</span> : reference.sessionId ? <span title={reference.sessionId}>MCP session {reference.sessionId}</span> : null}
    </span>
  ))}</div>;
}
