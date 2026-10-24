namespace PowerLoom.Features.Cleanup;

// Retention per artefact store, in days; 0 switches a store's cleanup off. The defaults are the buffers decided
// 2026-10-21 (the vault's powerloom-artefact-cleanup note). DryRun on: the job reports what would go and deletes nothing.
public sealed class CleanupSettings
{
    public bool DryRun { get; set; } = true;

    // A closed or done PBI's backlog folder (notes, tasks, attachments; the user's `## Notes` are saved first).
    public int ClosedPbiDays { get; set; } = 30;

    // Files the vault review and this job moved into a `.trash/` folder.
    public int TrashDays { get; set; } = 90;

    // Unusable import files set aside in a `failed/` folder.
    public int FailedImportDays { get; set; } = 30;

    // The per-tool trace of a successful run (`agent_usage.run_event`); tokens and cost stay.
    public int RunEventDays { get; set; } = 90;

    // A run's browser recordings on the PC (DevHub); a run with a failed case or a reported bug keeps them longer.
    public int BrowserArtefactDays { get; set; } = 14;

    public int FailedRunBrowserArtefactDays { get; set; } = 60;
}
