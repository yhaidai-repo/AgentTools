import { cutOutput } from "./cutOutput";

// A session's output, its last `capacity` characters kept; each read returns what came since the read before.
export class OutputBuffer {
  private text = "";
  // Characters dropped from the front so far, and how far the reader has read, both counted from the session's start.
  private dropped = 0;
  private readTo = 0;

  constructor(private readonly capacity: number) {}

  append(chunk: string): void {
    this.text += chunk;

    const excess = this.text.length - this.capacity;

    if (excess > 0) {
      this.text = this.text.slice(excess);
      this.dropped += excess;
    }
  }

  read(maxChars: number): { text: string; truncated: boolean } {
    const lost = Math.max(0, this.dropped - this.readTo);
    const unread = this.text.slice(Math.max(0, this.readTo - this.dropped));

    this.readTo = this.dropped + this.text.length;

    const cut = cutOutput(unread, maxChars, "");

    return lost > 0 ? { text: `[… ${lost} earlier characters were dropped]\n${cut.text}`, truncated: true } : cut;
  }
}
