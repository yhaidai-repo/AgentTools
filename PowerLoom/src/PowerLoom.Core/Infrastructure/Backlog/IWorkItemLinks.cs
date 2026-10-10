using PowerLoom.Persistence.Enums;

namespace PowerLoom.Infrastructure.Backlog;

// A PBI's page in the external tracker; the integration library supplies it (null for a local PBI or a vault
// without the integration).
public interface IWorkItemLinks
{
    Task<string?> WorkItemUrlAsync(string vault, int adoId, WorkItemSource source, CancellationToken cancellation);
}
