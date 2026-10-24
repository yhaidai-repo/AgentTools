namespace PowerLoom.Infrastructure.VaultScan.Models;

// One `[[target#heading|label]]` link in a note (code blocks and inline code don't count). `From` is the linking note,
// `Target` as written without heading and label, `Line` 1-based, `Text` the whole line trimmed.
public sealed record WikiLink(string From, string Target, string? Heading, string? Label, int Line, string Text);
