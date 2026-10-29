import { Panel } from "@/components/Panel";
import { PeriodPicker } from "@/components/PeriodPicker";
import { TimeAgo } from "@/components/TimeAgo";
import type { DeadLetter } from "@/lib/deadLetters";
import { DeadLetterControls } from "./DeadLetterControls";

// Messages PowerLoom gave up on after its retries: errors outside a single run. They belong to the whole PowerLoom, not
// a vault. The dashboard keeps its own period picker visible even when the queue is empty or unavailable.
export function DeadLetters({ letters, range }: { letters: DeadLetter[] | null; range: string }) {
  return (
    <div id="dead-letters">
      <Panel title={<span>Dead letters <small>gave up after the retries · Replay runs one again, Discard drops it</small></span>} aside={<small>{letters?.length ?? "–"}</small>}>
        <div className="toolbar"><PeriodPicker value={range} path="/dashboard" keep={{ tab: "application" }} /></div>
        {letters === null && <p className="text-error">Dead letters could not be loaded. Try again when PowerLoom answers.</p>}
        {letters?.length === 0 && <p className="quiet-line"><span className="dot ok" />No dead letters in this period.</p>}
        {letters?.map((letter) => (
          <div key={letter.id} className="item-row">
            <span className="dot error" />
            <span className="item-title"><code>{letter.messageType}</code>{letter.replayable && <span className="muted"> (replaying)</span>}<span className="file-meta text-error">{letter.exceptionType ? `${letter.exceptionType}: ` : ""}{letter.exceptionMessage}</span></span>
            <span className="item-state"><TimeAgo date={letter.sentAt} /></span>
            <DeadLetterControls id={letter.id} replayable={letter.replayable} />
          </div>
        ))}
      </Panel>
    </div>
  );
}
