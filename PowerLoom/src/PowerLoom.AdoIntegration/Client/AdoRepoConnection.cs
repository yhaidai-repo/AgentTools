using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Settings;

namespace PowerLoom.AdoIntegration.Client;

// A repo's own calls (its refs, its pull requests) go to the ADO project it lives in, which can differ from the vault's
// project: Add review asked project ZZ for the ZZ Core repo and got TF401019 (2026-10-22).
public static class AdoRepoConnection
{
    public static AdoConnection For(AdoSettings ado, string? repoProject)
    {
        var project = string.IsNullOrWhiteSpace(repoProject) ? ado.Project : repoProject;

        return new AdoConnection(ado.OrgUrl, project, ado.Team, ado.Pat);
    }
}
