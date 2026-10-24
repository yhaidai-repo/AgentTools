namespace PowerLoom.Features.Cleanup.Models;

// A vault's cleanup on the Status page: its settings' mode and the last report, if any ran.
public sealed record CleanupStatus(string Vault, bool DryRun, CleanupReport? LastReport);
