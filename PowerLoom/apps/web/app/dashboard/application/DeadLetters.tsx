import { Panel } from "@/components/Panel";
import type { DeadLetter } from "@/lib/deadLetters";
import { DeadLetterRow } from "./DeadLetterRow";

const SHOWN = 10;

// Messages PowerLoom gave up on after its retries: errors outside a single run. They belong to the whole PowerLoom, not
// a vault. The latest ones show, whatever their age.
export function DeadLetters({ letters }: { letters: DeadLetter[] | null }) {
  return (
    <div id="dead-letters" className="gap-top">
      <Panel title={<span>Dead letters <small>gave up after the retries · Replay runs one again, Discard drops it</small></span>} aside={<small>{letters && letters.length > SHOWN ? `latest ${SHOWN} of ${letters.length}` : letters?.length ?? "–"}</small>}>
        {letters === null && <p className="text-error">Dead letters could not be loaded. Try again when PowerLoom answers.</p>}
        {letters?.length === 0 && <p className="quiet-line"><span className="dot ok" />No dead letters.</p>}
        {letters?.slice(0, SHOWN).map((letter) => <DeadLetterRow key={letter.id} letter={letter} />)}
      </Panel>
    </div>
  );
}
