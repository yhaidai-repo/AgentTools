/** What Settings shows to finish a device sign-in; link and code are null when the CLI's output couldn't be read. */
export interface CodexLoginStart {
  verificationUri: string | null;
  userCode: string | null;
  /** The CLI's own text, shown as it is when the link or the code couldn't be read from it. */
  output: string;
}
