import type { RunSession } from "@powerloom/core/src/models/RunSession";
import type { TraceLine } from "./TraceLine";

// One line of a session's trace: a trace line, or a sub-session folded under the call that started it.
export type SessionTraceLine = TraceLine | { kind: "session"; key: string; session: RunSession };
