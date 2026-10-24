// What a task waits for: you (an open human item), the dispatcher (held), an agent (open), or nothing any more.
export type TaskBucket = "you" | "held" | "open" | "done" | "cancelled";
