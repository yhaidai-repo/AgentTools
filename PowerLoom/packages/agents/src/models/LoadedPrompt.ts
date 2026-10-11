export interface LoadedPrompt {
  text: string;
  /** From the header comment `<!-- prompt: name · version: v1 -->`; stored with every run. */
  version: string;
}
