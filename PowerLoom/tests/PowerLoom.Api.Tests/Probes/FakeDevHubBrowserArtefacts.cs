using PowerLoom.DevHubIntegration.Features.BrowserArtefacts;
using PowerLoom.DevHubIntegration.Features.BrowserArtefacts.Models;
using PowerLoom.DevHubIntegration.Features.DevHub.Models;

namespace PowerLoom.Api.Tests.Probes;

// DevHub's recordings folders as a test sets them; a delete removes the owner from the list unless it is a dry run.
public sealed class FakeDevHubBrowserArtefacts : IDevHubBrowserArtefacts
{
    public List<OwnerArtefacts> Owners { get; } = [];

    public List<(string Owner, bool DryRun)> Deletes { get; } = [];

    // Null: DevHub doesn't answer.
    public bool Reachable { get; set; } = true;

    public Task<IReadOnlyList<OwnerArtefacts>?> ListOwnersAsync(DevHubTarget target, CancellationToken cancellation) =>
        Task.FromResult<IReadOnlyList<OwnerArtefacts>?>(Reachable ? Owners.ToList() : null);

    public Task<DeletedArtefacts?> DeleteOwnerAsync(DevHubTarget target, string owner, bool dryRun, CancellationToken cancellation)
    {
        var found = Owners.SingleOrDefault(entry => entry.Owner == owner);

        Deletes.Add((owner, dryRun));

        if (!dryRun)
            Owners.RemoveAll(entry => entry.Owner == owner);

        return Task.FromResult(found is null ? null : new DeletedArtefacts(owner, 3, found.Bytes, dryRun));
    }
}
