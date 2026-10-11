// One `authors` entry of a docs-vault note (AGENTS.md frontmatter): "<writer> (<context>, <date>)".
export interface NoteAuthor {
  writer: string;
  context: string;
  date: string;
}
