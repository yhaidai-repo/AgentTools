import type { VerificationTruth } from "./VerificationTruth";

// A phase's verification as gsd-verifier wrote it: passed, gaps_found or human_needed (missing when none ran), its score
// and the truths it checked.
export interface PhaseVerification {
  phase: string;
  status: string;
  score: string;
  truths: VerificationTruth[];
}
