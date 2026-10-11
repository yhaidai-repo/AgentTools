// How a finished PBI went (user decision 2026-10-05): the agents' rating, the user's hours, and what went wrong, if anything.
export interface PbiFeedback {
  adoId: number;
  rating: number; // 1–10
  effortHours: number;
  whatWentWrong: string | null;
  fault: "Human" | "Agent";
}
