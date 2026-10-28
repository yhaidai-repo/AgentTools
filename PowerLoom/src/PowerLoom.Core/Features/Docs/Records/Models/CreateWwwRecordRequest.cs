using PowerLoom.Infrastructure.VaultScan.Models;

namespace PowerLoom.Features.Docs.Records.Models;

// A What-went-wrong record for the vault's www-log.md: `Kind` "complaint" or "notice", `Fault` "Human" or "Agent";
// `Source` says what created it (a chat, the web).
public sealed record CreateWwwRecordRequest(string Title, string Kind, string Project, string Planned, string Happened, string Fault, string? RootCause, string? Resolution, string? PreventiveAction, string? Assumptions, string Source, RecordWorkContext? Context = null);