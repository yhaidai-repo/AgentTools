using PowerLoom.DevHubIntegration.Features.BrowserArtefacts.Models;
using PowerLoom.DevHubIntegration.Features.DevHub.Models;

namespace PowerLoom.DevHubIntegration.Features.BrowserArtefacts;

// DevHub's browser recordings on the PC (`<stack>/browser/<owner>/<case>/`), which the container can't reach itself.
// Null answers mean DevHub didn't answer: the cleanup tries again the next day.
public interface IDevHubBrowserArtefacts
{
    Task<IReadOnlyList<OwnerArtefacts>?> ListOwnersAsync(DevHubTarget target, CancellationToken cancellation);

    Task<DeletedArtefacts?> DeleteOwnerAsync(DevHubTarget target, string owner, bool dryRun, CancellationToken cancellation);
}
