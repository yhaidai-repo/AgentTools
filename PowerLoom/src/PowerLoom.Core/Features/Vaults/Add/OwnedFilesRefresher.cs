using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Vaults.Add;

// On every start, PowerLoom's own files in each connected vault follow this version (POWERLOOM.md: the tools a Claude
// chat in the vault can call). A vault that can't be written is logged, never a reason to stop PowerLoom.
public sealed class OwnedFilesRefresher(IServiceScopeFactory scopes, VaultInitializer initializer, ILogger<OwnedFilesRefresher> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        foreach (var vault in await ConnectedVaultsAsync(cancellationToken))
            await RefreshAsync(vault, cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private async Task<List<string>> ConnectedVaultsAsync(CancellationToken cancellation)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        return await db.Vaults.AsNoTracking().Where(vault => vault.RemovedAt == null).Select(vault => vault.Name).ToListAsync(cancellation);
    }

    private async Task RefreshAsync(string vault, CancellationToken cancellation)
    {
        try
        {
            if (await initializer.RefreshOwnedFilesAsync(vault, cancellation))
                logger.LogInformation("vault {Vault}: PowerLoom's own files updated", vault);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            logger.LogError(error, "vault {Vault}: PowerLoom's own files could not be updated", vault);
        }
    }
}
