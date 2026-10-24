using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.AdoIntegration.Features.SyncRepositories;

// The catalog mirrors ADO's repos of the organization; `excluded` (the user's enable switch) is never overwritten.
public static class SyncRepositoriesHandler
{
    public static async Task Handle(SyncRepositories message, AdoSettingsStore settings, IAdoClientFactory clients, PowerLoomDbContext db, ILogger<SyncRepositories> logger, CancellationToken cancellation)
    {
        var ado = await settings.ReadAdoAsync(message.Vault, cancellation);

        if (ado is null || !ado.IsConfigured)
        {
            logger.LogInformation("repositories {Vault}: ADO settings are not configured", message.Vault);

            return;
        }

        var client = clients.For(new AdoConnection(ado.OrgUrl, ado.Project, ado.Team, ado.Pat));
        var repositories = (await client.ListRepositoriesAsync(cancellation)).Where(repository => !repository.IsDisabled).ToList();

        foreach (var repository in repositories)
            await UpsertAsync(db, message.Vault, repository, cancellation);

        await db.SaveChangesAsync(cancellation);
        logger.LogInformation("repositories {Vault}: {Count} repos", message.Vault, repositories.Count);
    }

    private static async Task UpsertAsync(PowerLoomDbContext db, string vault, AdoRepository repository, CancellationToken cancellation)
    {
        var row = await db.Repos.FindAsync([repository.Id], cancellation);

        if (row is null)
            db.Repos.Add(row = new Repo { Id = repository.Id, Vault = vault, Kind = RepoKind.Ado, AdoProject = "", Name = "", RemoteUrl = "" });

        row.AdoProject = repository.Project;
        row.Name = repository.Name;
        row.RemoteUrl = repository.RemoteUrl;
        row.DefaultBranch = repository.DefaultBranch;
        row.SyncedAt = DateTime.UtcNow;
    }
}
