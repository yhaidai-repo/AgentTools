// How a session of a run ended, as its session_end said; `running` while the run still works, `lost` when the run
// ended without the session's end reaching the trace.
export type RunSessionStatus = "running" | "completed" | "failed" | "stopped" | "unfinished" | "lost";
