namespace PowerLoom.Features.Cleanup.Models;

// What every cleaner gets: the vault, the settings, the moment the buffers count from, and whether to delete.
public sealed record CleanupContext(string Vault, CleanupSettings Settings, DateTimeOffset Now)
{
    public bool DryRun => Settings.DryRun;

    // The latest moment an artefact may date from and still go; null when the store's cleanup is off (0 days).
    public DateTimeOffset? CutoffOf(int days) => days > 0 ? Now.AddDays(-days) : null;
}
