using PowerLoom.Infrastructure.VaultScan.Models;

namespace PowerLoom.Features.Docs.Records.Models;

// One What-went-wrong record as the log renders it (the www-record skill's format).
public sealed record WwwEntry(
    string Title,
    string Kind,
    string Project,
    string Planned,
    string Happened,
    string Fault,
    string? RootCause,
    string? Resolution,
    string? PreventiveAction,
    string? Assumptions,
    RecordWorkContext? Context = null);