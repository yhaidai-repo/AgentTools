import { Panel } from "@/components/Panel";
import { TimeAgo } from "@/components/TimeAgo";
import type { DeadLetter } from "@/lib/deadLetters";
import { DeadLetterControls } from "./DeadLetterControls";

// Messages PowerLoom gave up on after its retries: errors outside a single run. They belong to the whole PowerLoom, not
// a vault. None in the period is one quiet line (user decision 2026-10-18).
export function DeadLetters({ letters }: { letters: DeadLetter[] }) {
  if (letters.length === 0) {
    return <p className="quiet-line"><span className="dot ok" />No dead letters in this period: messages PowerLoom gives up on after its retries show here, to replay or discard.</p>;
  }

  return (
    <Panel title={<span>Dead letters <small>gave up after the retries · Replay runs one again, Discard drops it</small></span>} aside={<small>{letters.length}</small>}>
      {letters.map((letter) => (
        <div key={letter.id} className="item-row">
          <span className="dot error" />
          <span className="item-title"><code>{letter.messageType}</code>{letter.replayable && <span className="muted"> (replaying)</span>}<span className="file-meta text-error">{letter.exceptionType ? `${letter.exceptionType}: ` : ""}{letter.exceptionMessage}</span></span>
          <span className="item-state"><TimeAgo date={letter.sentAt} /></span>
          <DeadLetterControls id={letter.id} replayable={letter.replayable} />
        </div>
      ))}
    </Panel>
  );
}
