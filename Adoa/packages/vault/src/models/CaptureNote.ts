export interface CaptureNote {
  title: string;
  project: string;
  target: string;
  /** e.g. "agent research RUN-22 (AT-30270-001, PBI-30270)" */
  source: string;
  created: Date;
  captured: { fact: string; evidence: string }[];
  toFill: string[];
}
