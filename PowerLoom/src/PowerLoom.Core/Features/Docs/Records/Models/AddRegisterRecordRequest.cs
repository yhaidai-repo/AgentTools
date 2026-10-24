namespace PowerLoom.Features.Docs.Records.Models;

// A chat's record for a project's register: `Kind` is "questions" (open questions) or "issues" (known issues).
public sealed record AddRegisterRecordRequest(string Project, string Kind, string Title, string Text, string[]? Default, string[]? Options);
