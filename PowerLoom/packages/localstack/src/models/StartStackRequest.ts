// POST /stack. The owner (a run) is the only one whose stop the bridge accepts while the stack runs.
export interface StartStackRequest {
  services: string[];
  branch?: string;
  ttlMinutes?: number;
  owner: string;
}
