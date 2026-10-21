namespace PowerLoom.Features.Cleanup.Models;

public sealed record SaveCleanupSettingsRequest(bool DryRun, int ClosedPbiDays, int TrashDays, int FailedImportDays, int RunEventDays, int BrowserArtefactDays, int FailedRunBrowserArtefactDays);
