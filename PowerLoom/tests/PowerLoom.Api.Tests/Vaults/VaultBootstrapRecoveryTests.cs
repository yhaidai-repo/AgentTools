using System.Net;
using System.Text.Json;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using PowerLoom.Features.Vaults.Add.Models;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Api.Tests.Vaults;

[Collection(PowerLoomCollection.Name)]
public sealed class VaultBootstrapRecoveryTests(PowerLoomHost host)
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Failed_template_initialization_rolls_back_new_or_restored_activation_and_schedule(bool restored)
    {
        var name = $"bootstrap-files-{Guid.NewGuid():N}";
        var removedAt = DateTime.UtcNow.AddDays(-1);
        if (restored)
            await SeedRemovedVaultAsync(name, removedAt, withSchedule: true);

        var root = Directory.CreateDirectory(Path.Combine(host.VaultsRoot, name)).FullName;
        var human = Path.Combine(root, "human.md");
        await File.WriteAllTextAsync(human, "Human content must survive.");
        var options = host.Host.Services.GetRequiredService<IOptions<VaultOptions>>().Value;
        var originalHome = options.TemplateHome;
        try
        {
            options.TemplateHome = Path.Combine(host.VaultsRoot, "missing-templates-" + Guid.NewGuid().ToString("N"));
            await Assert.ThrowsAnyAsync<Exception>(() => host.Host.PostJson(new AddVaultRequest(name), "/api/vaults").Receive<AddedVault>());
        }
        finally { options.TemplateHome = originalHome; }

        await AssertNotActivatedAsync(name, restored, restored ? 1 : 0);
        Assert.False(File.Exists(Path.Combine(root, "AGENTS.md")));
        Assert.Equal("Human content must survive.", await File.ReadAllTextAsync(human));
        await AssertSuccessfulRetryAsync(name);
        Assert.Equal("Human content must survive.", await File.ReadAllTextAsync(human));
        if (restored)
        {
            using var scope = host.Host.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
            var schedule = await db.TaskSchedules.SingleAsync(row => row.Vault == name);
            Assert.Equal("Preserved schedule", schedule.Name);
            Assert.False(schedule.Enabled);
            Assert.Equal("30 8 * * 2", schedule.Cron);
        }
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Failed_schedule_persistence_rolls_back_activation_and_can_be_retried(bool restored)
    {
        var name = $"bootstrap-schedule-{Guid.NewGuid():N}";
        if (restored)
            await SeedRemovedVaultAsync(name, DateTime.UtcNow.AddDays(-1), withSchedule: false);
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        // Private fixture database only. The trigger fails after the endpoint saves its new/restored vault row.
        await db.Database.ExecuteSqlRawAsync("""
            CREATE FUNCTION fixture_reject_bootstrap_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'Synthetic schedule failure'; END $$;
            CREATE TRIGGER fixture_reject_bootstrap_schedule BEFORE INSERT ON task_schedule
            FOR EACH ROW WHEN (NEW.vault LIKE 'bootstrap-schedule-%')
            EXECUTE FUNCTION fixture_reject_bootstrap_schedule();
            """);
        try
        {
            await Assert.ThrowsAnyAsync<Exception>(() => host.Host.PostJson(new AddVaultRequest(name), "/api/vaults").Receive<AddedVault>());
        }
        finally
        {
            await db.Database.ExecuteSqlRawAsync("DROP TRIGGER fixture_reject_bootstrap_schedule ON task_schedule; DROP FUNCTION fixture_reject_bootstrap_schedule();");
        }
        await AssertNotActivatedAsync(name, restored, 0);
        await AssertSuccessfulRetryAsync(name);
    }

    private async Task SeedRemovedVaultAsync(string name, DateTime removedAt, bool withSchedule)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        db.Vaults.Add(new Vault { Name = name, Features = "{\"adoSync\":true}", RemovedAt = removedAt });
        if (withSchedule)
            db.TaskSchedules.Add(new TaskSchedule { Vault = name, AgentId = "*", TaskType = "vault-review", Name = "Preserved schedule", Cron = "30 8 * * 2", Enabled = false, Params = "{}" });
        await db.SaveChangesAsync();
    }

    private async Task AssertNotActivatedAsync(string name, bool restored, int schedules)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var vault = await db.Vaults.AsNoTracking().SingleOrDefaultAsync(row => row.Name == name);
        if (restored)
        {
            Assert.NotNull(vault!.RemovedAt);
            using var features = JsonDocument.Parse(vault.Features);
            Assert.True(features.RootElement.GetProperty("adoSync").GetBoolean());
        }
        else Assert.Null(vault);
        Assert.Equal(schedules, await db.TaskSchedules.CountAsync(row => row.Vault == name));
    }

    private async Task AssertSuccessfulRetryAsync(string name)
    {
        var added = await host.Host.PostJson(new AddVaultRequest(name), "/api/vaults").Receive<AddedVault>();
        Assert.Equal(name, added!.Vault);
        var root = Path.Combine(host.VaultsRoot, name);
        Assert.Contains($"{PowerLoomHost.HostRoot}/{name}", await File.ReadAllTextAsync(Path.Combine(root, "AGENTS.md")));
        Assert.True(File.Exists(Path.Combine(root, "POWERLOOM.md")));
        Assert.True(File.Exists(Path.Combine(root, ".mcp.json")));
        Assert.True(File.Exists(Path.Combine(root, ".codex/config.toml")));
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        Assert.Null((await db.Vaults.SingleAsync(row => row.Name == name)).RemovedAt);
        Assert.Equal(1, await db.TaskSchedules.CountAsync(row => row.Vault == name && row.TaskType == "vault-review"));
        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new AddVaultRequest(name)).ToUrl("/api/vaults");
            scenario.StatusCodeShouldBe(HttpStatusCode.Conflict);
        });
        Assert.Equal(1, await db.TaskSchedules.CountAsync(row => row.Vault == name && row.TaskType == "vault-review"));
    }
}
