import type { DeviceCode } from "./models/DeviceCode";

// The CLI colours its output; codes look like ABCD-1234 (OpenAI's device flow). Read defensively: the device flow is
// beta and its wording may change, so anything unreadable is shown raw instead.
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const LINK = /https:\/\/[^\s"'<>]+/;
const CODE = /\b[A-Z0-9]{4,}(?:-[A-Z0-9]{4,})+\b/;

export function plainText(output: string): string {
  return output.replace(ANSI, "");
}

/** The link and the code in `codex login --device-auth`'s output, or null while either is missing. */
export function deviceCodeOf(output: string): DeviceCode | null {
  const text = plainText(output);
  const link = LINK.exec(text)?.[0];
  const code = CODE.exec(text)?.[0];

  return link && code ? { verificationUri: link.replace(/[.,)]+$/, ""), userCode: code } : null;
}
