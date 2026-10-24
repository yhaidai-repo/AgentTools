using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.ConfluenceIntegration.Status;

// Settings shows whether Confluence pages can be fetched; the token stays here. Saved at start (PowerLoom's config key
// `confluence`: the account, or null), the way the worker reported it.
public sealed class ConfluenceStatusReporter(IServiceScopeFactory scopes, IOptions<ConfluenceOptions> options) : IHostedService
{
    private const string Key = "confluence";

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var row = await db.Configs.SingleOrDefaultAsync(entry => entry.Key == Key, cancellationToken);

        if (row is null)
            db.Configs.Add(row = new Config { Key = Key, Value = "" });

        row.Value = System.Text.Json.JsonSerializer.Serialize(new { email = options.Value.IsConfigured ? options.Value.Email.Trim() : null });
        row.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
