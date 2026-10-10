using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.AdoIntegration;

// A PBI's page in Azure DevOps: null for a local PBI (no counterpart) or a vault without the integration.
public sealed class WorkItemLinks(AdoSettingsStore settings) : IWorkItemLinks
{
    public async Task<string?> WorkItemUrlAsync(string vault, int adoId, WorkItemSource source, CancellationToken cancellation)
    {
        if (source == WorkItemSource.Local)
            return null;

        var ado = await settings.ReadAdoAsync(vault, cancellation);

        return ado is null ? null : $"{ado.OrgUrl.TrimEnd('/')}/{Uri.EscapeDataString(ado.Project)}/_workitems/edit/{adoId}";
    }
}
