// Long output keeps its start (what ran) and, larger, its end (the error, the summary).
const HEAD_SHARE = 1 / 3;

export function cutOutput(text: string, maxChars: number, note: string): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }

  const head = Math.floor(maxChars * HEAD_SHARE);
  const tail = maxChars - head;
  const cut = text.length - head - tail;

  return { text: `${text.slice(0, head)}\n\n[… ${cut} characters cut${note}]\n\n${text.slice(text.length - tail)}`, truncated: true };
}
