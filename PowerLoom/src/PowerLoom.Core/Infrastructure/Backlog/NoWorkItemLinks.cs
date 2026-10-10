using PowerLoom.Persistence.Enums;

namespace PowerLoom.Infrastructure.Backlog;

// Without an integration library, PBIs have no external page.
public sealed class NoWorkItemLinks : IWorkItemLinks
{
    public Task<string?> WorkItemUrlAsync(string vault, int adoId, WorkItemSource source, CancellationToken cancellation) => Task.FromResult<string?>(null);
}
