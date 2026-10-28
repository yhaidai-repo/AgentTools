// One line of a hunk: context (" "), removed ("-") or added ("+").
export interface HunkLine {
  kind: "context" | "remove" | "add";
  text: string;
}
