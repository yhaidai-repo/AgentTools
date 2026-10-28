const BOM = "﻿";

// A text file split into lines, remembering what an edit must give back unchanged: its BOM, its line ending (CRLF or
// LF) and whether it ends with a newline.
export class TextFile {
  private constructor(
    readonly lines: string[],
    private readonly bom: boolean,
    private readonly eol: string,
    private readonly finalNewline: boolean,
  ) {}

  static parse(content: string): TextFile {
    const bom = content.startsWith(BOM);
    const body = bom ? content.slice(1) : content;
    const eol = body.includes("\r\n") ? "\r\n" : "\n";
    const lines = body.split(/\r?\n/);
    const finalNewline = lines.length > 1 && lines[lines.length - 1] === "";

    if (finalNewline || body.length === 0) {
      lines.pop();
    }

    return new TextFile(lines, bom, eol, finalNewline);
  }

  /** A new file: LF and a final newline. */
  static of(lines: string[]): TextFile {
    return new TextFile(lines, false, "\n", true);
  }

  // An empty file that gets lines gets the final newline a new file has.
  withLines(lines: string[]): TextFile {
    const wasEmpty = this.lines.length === 0;

    return new TextFile(lines, this.bom, this.eol, this.finalNewline || wasEmpty);
  }

  toString(): string {
    const body = this.lines.join(this.eol) + (this.finalNewline && this.lines.length > 0 ? this.eol : "");

    return this.bom ? BOM + body : body;
  }
}
