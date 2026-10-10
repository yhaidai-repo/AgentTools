using PowerLoom.AdoIntegration.Client.Models;

namespace PowerLoom.AdoIntegration.Client;

public static class SprintResolver
{
    public const string Current = "current";

    // "current" follows ADO's own current iteration, so the sync moves on when the sprint ends.
    public static async Task<AdoIteration?> ResolveAsync(IAdoClient client, string selection, CancellationToken cancellation)
    {
        if (selection == Current)
            return (await client.GetIterationsAsync(true, cancellation)).FirstOrDefault();

        return (await client.GetIterationsAsync(false, cancellation)).FirstOrDefault(iteration => iteration.Path == selection);
    }
}
