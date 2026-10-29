import { StatTile } from "@/components/StatTile";
import type { StateLevel, SystemStatus } from "@/lib/systemStatus";
import { toneOfState, worstTone } from "@/lib/tone";
import type { Tone } from "@/models/Tone";
import { AttentionList } from "./AttentionList";
import { latestRate, type Rates } from "./RatesSection";

// The four numbers that say whether PowerLoom is well: the system with what needs attention, the agent-runner, the dead
// letters, and how fast PowerLoom answers.
export function HealthBand({ status, rates }: { status: SystemStatus; rates: Rates }) {
  const stuck = status.runs.filter((run) => run.stuck).length;
  const p95 = latestRate(rates.p95);
  const requests = latestRate(rates.requests);

  return (
    <div className="band">
      <SystemTile status={status} />
      <StatTile label="agent-runner" value={runnerValue(status)} note={`${status.runs.length} running · ${stuck} stuck`} tone={problemTone(status.runner.state)} />
      <StatTile label={<a href="#dead-letters">Dead letters</a>} value={String(status.messaging.deadLetters)} note={`${status.messaging.incoming} waiting · ${status.messaging.deadLettersLast24h} in 24 h`} tone={status.messaging.deadLetters > 0 ? "warn" : "plain"} />
      <StatTile label="HTTP p95" value={p95 === null ? "–" : `${Math.round(p95)} ms`} note={requests === null ? "no requests measured" : `${Math.round(requests)} requests in the last 30 min`} />
    </div>
  );
}

// "All OK" lights up; otherwise the issues, each a link to its part in the scheme.
function SystemTile({ status }: { status: SystemStatus }) {
  const issues = status.attention.length;
  const tone: Tone = issues === 0 ? "good" : worstTone(status.attention.map((item) => toneOfState(item.severity)));

  return (
    <StatTile label="System" value={issues === 0 ? "All OK" : `${issues} ${issues === 1 ? "issue" : "issues"}`} note={issues === 0 ? "every part answers" : <AttentionList items={status.attention} />} tone={tone} />
  );
}

function runnerValue(status: SystemStatus): string {
  if (!status.runner.reachable) {
    return "Down";
  }

  return status.runner.runningTask ? "Running" : "Idle";
}

// A healthy part stays plain: only problems take a colour.
function problemTone(state: StateLevel): Tone {
  return state === "ok" ? "plain" : toneOfState(state);
}
