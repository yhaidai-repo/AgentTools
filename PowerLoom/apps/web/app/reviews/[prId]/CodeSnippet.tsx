// The code under a comment, as reviewed, with its line numbers; the commented lines are highlighted.
export function CodeSnippet({ code, firstLine, startLine, endLine }: { code: string; firstLine: number; startLine: number; endLine: number }) {
  const lines = code.split("\n");

  return (
    <pre className="code-snippet">
      {lines.map((line, index) => {
        const number = firstLine + index;
        const isCommented = number >= startLine && number <= endLine;

        return (
          <div key={number} className={isCommented ? "code-line commented" : "code-line"}>
            <span className="line-number">{number}</span>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}
