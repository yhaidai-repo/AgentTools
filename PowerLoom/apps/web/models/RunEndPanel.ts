// How a run's page says the run ended, beside its trace: a failure in the error tone, a user's stop in none.
export interface RunEndPanel {
  title: "Failure" | "Stopped";
  tone: "error" | null;
}
