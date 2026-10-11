// The parts of VaultCapture's vault-rules.json the agent tool uses; the module itself stays the authority.
export interface CaptureRules {
  guidance: string[];
  draft: {
    namePattern: string;
    notePathPattern: string;
    maxLines: number;
  };
}
