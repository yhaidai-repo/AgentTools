// The code-review agent; queueing, closing and deleting reviews are PowerLoom's (2026-10-11).
export const REVIEW_AGENT = "code-review";
// Every agent that takes review tasks (Better Review beside Code review, 2026-10-16); a queued review starts on whichever
// of them is enabled.
export const REVIEW_AGENTS = [REVIEW_AGENT, "better-review"];
