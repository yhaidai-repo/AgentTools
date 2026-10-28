// Where the branch stands for the person who reviews and pushes it: verified with nothing open, verified but with tests
// only a person can run, or with gaps (plans not done, verification failed).
export const HAND_OVER_STATES = ["ready", "needs-person", "gaps"] as const;

export type HandOverState = typeof HAND_OVER_STATES[number];
