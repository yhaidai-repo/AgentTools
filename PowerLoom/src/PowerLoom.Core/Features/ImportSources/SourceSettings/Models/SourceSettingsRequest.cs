namespace PowerLoom.Features.ImportSources.SourceSettings.Models;

// `ImportFolder`: one folder name inside the import inbox, empty for the inbox root.
public sealed record SourceSettingsRequest(bool Enabled, string Cron, int MaxItemsPerRun, string? ImportFolder);
