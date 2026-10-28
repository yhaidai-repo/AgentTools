// Time for the search throttle; tests pass their own.
export interface ThrottleClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}
