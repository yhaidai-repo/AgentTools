namespace PowerLoom.AdoIntegration.Features.Settings.Models;

public sealed record PbiSyncSettingsRequest(bool Enabled, string Cron, int MaxItemsPerRun, string? Sprint);
