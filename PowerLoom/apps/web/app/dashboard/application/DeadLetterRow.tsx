"use client";

import { useState } from "react";
import { TimeAgo } from "@/components/TimeAgo";
import type { DeadLetter } from "@/lib/deadLetters";
import { DeadLetterControls } from "./DeadLetterControls";

// One dead letter: the error is cut to one line until you click it, then the whole message shows.
export function DeadLetterRow({ letter }: { letter: DeadLetter }) {
  const [isOpen, setIsOpen] = useState(false);
  const error = `${letter.exceptionType ? `${letter.exceptionType}: ` : ""}${letter.exceptionMessage ?? ""}`;

  return (
    <div className="item-row dead-letter">
      <span className="dot error" />
      <span className="item-title"><code>{letter.messageType}</code>{letter.replayable && <span className="muted"> (replaying)</span>}
        <button type="button" className={`dead-letter-error file-meta text-error${isOpen ? " open" : ""}`} aria-expanded={isOpen} title={isOpen ? "Collapse" : "Show the whole message"} onClick={() => setIsOpen(!isOpen)}>{error}</button>
      </span>
      <span className="item-state"><TimeAgo date={letter.sentAt} /></span>
      <DeadLetterControls id={letter.id} replayable={letter.replayable} />
    </div>
  );
}
