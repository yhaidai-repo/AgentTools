namespace PowerLoom.Features.Cleanup.Models;

// One store's share of a cleanup; `Note` says why nothing happened (off, DevHub unreachable).
public sealed record CleanupStoreReport(string Store, int Items, long Bytes, string? Note);
