using PowerLoom.Infrastructure.VaultScan.Models;

namespace PowerLoom.Infrastructure.VaultCapture.Models;

// A record for a project's register: `Kind` is "questions" (open questions) or "issues" (known issues).
public sealed record NewRegisterRecord(string Project, string Kind, string Title, string Text, string[] Default, string[] Options, RecordWorkContext? Context = null);