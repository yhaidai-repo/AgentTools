using PowerLoom.Features.Cleanup.Models;

namespace PowerLoom.Features.Cleanup;

// One artefact store the cleanup job empties past its buffer; a cleaner reports in a dry run and deletes otherwise.
public interface IArtefactCleaner
{
    string Store { get; }

    Task<CleanerResult> CleanAsync(CleanupContext context, CancellationToken cancellation);
}
