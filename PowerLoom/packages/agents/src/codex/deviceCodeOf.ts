import type { DeviceCode } from "./models/DeviceCode";

// The CLI colours its output; codes look like ABCD-1234 (OpenAI's device flow). Read defensively: the device flow is
// beta and its wording may change, so anything unreadable is shown raw instead.
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const LINKS = /https:\/\/[^\s"'<>]+/g;
// The sign-in page is OpenAI's: another link in the output (a help page, a notice) is never offered as the one to open.
const SIGN_IN_HOSTS = ["openai.com", "chatgpt.com"];
const CODE = /\b[A-Z0-9]{4,}(?:-[A-Z0-9]{4,})+\b/;

export function plainText(output: string): string {
  return output.replace(ANSI, "");
}

/** The link and the code in `codex login --device-auth`'s output, or null while either is missing. */
export function deviceCodeOf(output: string): DeviceCode | null {
  const text = plainText(output);
  const link = signInLinkOf(text);
  const code = CODE.exec(text)?.[0];

  return link && code ? { verificationUri: link, userCode: code } : null;
}

// OpenAI's links, a device page first.
function signInLinkOf(text: string): string | undefined {
  const links = [...text.matchAll(LINKS)].map((match) => match[0].replace(/[.,)]+$/, "")).filter(isOpenAiLink);

  return links.find((link) => link.includes("/device")) ?? links[0];
}

function isOpenAiLink(link: string): boolean {
  try {
    const host = new URL(link).hostname;

    return SIGN_IN_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}
