using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using PowerLoom.DevHubIntegration.Features.LocalBranches.Models;
using PowerLoom.DevHubIntegration.Settings;
using PowerLoom.Infrastructure.LocalBranches;
using PowerLoom.Infrastructure.LocalBranches.Models;

namespace PowerLoom.DevHubIntegration.Features.LocalBranches;

// Asks the vault's DevHub whether a branch exists in the repo's checkout on the PC (GET /repos/branch).
public sealed class DevHubLocalBranches(DevHubSettingsStore store) : ILocalBranches
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(20) };

    public async Task<LocalBranchLookup> FindAsync(string vault, string repo, string branch, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);

        if (!settings.Enabled || string.IsNullOrWhiteSpace(settings.Token))
            return LocalBranchLookup.Unreachable($"DevHub is off for {vault} (Settings → DevHub), so branches on this PC can't be seen.");

        try
        {
            return await AskAsync(settings, repo, branch, cancellation);
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException)
        {
            return LocalBranchLookup.Unreachable($"DevHub at {settings.Url} doesn't answer ({error.Message}); start it to use branches on this PC.");
        }
    }

    private static async Task<LocalBranchLookup> AskAsync(DevHubSettings settings, string repo, string branch, CancellationToken cancellation)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{settings.Url.TrimEnd('/')}/repos/branch?repo={Uri.EscapeDataString(repo)}&branch={Uri.EscapeDataString(branch)}");

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.Token);

        using var response = await Http.SendAsync(request, cancellation);

        if (response.StatusCode == HttpStatusCode.NotFound)
            return LocalBranchLookup.Missing();

        if (!response.IsSuccessStatusCode)
            return LocalBranchLookup.Unreachable($"DevHub answered {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync(cancellation)}");

        var found = await response.Content.ReadFromJsonAsync<DevHubLocalBranch>(cancellation);

        return found is null ? LocalBranchLookup.Missing() : LocalBranchLookup.Found(found.Head);
    }
}
