// The models of GSD's execution sub-agents for one run (`.planning/config.json` model_overrides): the executors that write
// the code and the verifiers that check it. A task's `data.gsdModels` may set either for its runs (an executor trial).
export interface ImplementationModels {
  executor: string;
  verifier: string;
}
