namespace PowerLoom.Features.Cleanup.Models;

// One artefact the cleanup removed, or would remove in a dry run; `Error` when the removal failed.
public sealed record CleanupAction(string Store, string Target, long Bytes, bool Deleted, string? Error = null)
{
    public static CleanupAction Planned(string store, string target, long bytes) => new(store, target, bytes, false);

    public static CleanupAction Removed(string store, string target, long bytes) => new(store, target, bytes, true);

    public static CleanupAction Failed(string store, string target, long bytes, string error) => new(store, target, bytes, false, error);
}
