using Alba;
using JasperFx.CodeGeneration;
using JasperFx.CommandLine;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.AdoIntegration.Client;
using PowerLoom.AzureIntegration.Features.Resources;
using PowerLoom.ConfluenceIntegration.Client;
using PowerLoom.Infrastructure.Runner;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Infrastructure.VaultCapture;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.LocalStackIntegration.Features.Bridge;
using PowerLoom.SqlIntegration.Features.Connections;
using Testcontainers.PostgreSql;
using Wolverine;

namespace PowerLoom.Api.Tests;

// The API on a throwaway Postgres and a temp vaults folder, shared by a test class.
public sealed class PowerLoomHost : IAsyncLifetime
{
    public const string Vault = "test-vault";

    // The vaults root as the PC would see it (written into new vaults' files and chat links).
    public const string HostRoot = "D:/pc/vaults";
    public const string AgentTools = "D:/pc/AgentTools";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16-alpine").Build();

    public IAlbaHost Host { get; private set; } = null!;

    public string VaultsRoot { get; } = Path.Combine(Path.GetTempPath(), "powerloom-tests", Guid.NewGuid().ToString("N"));

    public string VaultRoot => Path.Combine(VaultsRoot, Vault);

    // The repos root (git checkouts) and the skill folders (own/ is PowerLoom's, editable; other/ is read-only).
    public string ReposRoot => Path.Combine(VaultsRoot, "..", "repos-" + Path.GetFileName(VaultsRoot));

    public string SkillsRoot => Path.Combine(VaultsRoot, "..", "skills-" + Path.GetFileName(VaultsRoot));

    // The import inbox (a folder per source inside it).
    public string ImportRoot => Path.Combine(VaultsRoot, "..", "inbox-" + Path.GetFileName(VaultsRoot));

    // PowerLoom's backlog vault (a folder per vault), where chat notes are written.
    public string BacklogRoot => Path.Combine(VaultsRoot, "..", "backlog-" + Path.GetFileName(VaultsRoot));

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        Directory.CreateDirectory(VaultRoot);
        Directory.CreateDirectory(Path.Combine(BacklogRoot, Vault));
        // Program ends in RunJasperFxCommands: the test host must start the app instead of parsing commands.
        JasperFxEnvironment.AutoStartHost = true;

        // Environment variables are read after appsettings*.json, so they override the Development connection string;
        // config added through the test host lands before the files and loses.
        Environment.SetEnvironmentVariable("ConnectionStrings__PowerLoom", _postgres.GetConnectionString());
        Environment.SetEnvironmentVariable("Vaults__Root", VaultsRoot);
        Environment.SetEnvironmentVariable("Vaults__HostRoot", HostRoot);
        Environment.SetEnvironmentVariable("Vaults__TemplateHome", WriteTemplates());
        Environment.SetEnvironmentVariable("Vaults__Exclude", "powerloom-backlog");
        Environment.SetEnvironmentVariable("Backlog__Root", BacklogRoot);
        Environment.SetEnvironmentVariable("Import__InboxRoot", ImportRoot);
        Environment.SetEnvironmentVariable("Repos__Mount", ReposRoot);
        Environment.SetEnvironmentVariable("Skills__Folders__0", Path.Combine(SkillsRoot, "own"));
        Environment.SetEnvironmentVariable("Skills__Folders__1", Path.Combine(SkillsRoot, "other"));
        Environment.SetEnvironmentVariable("Skills__Editable", Path.Combine(SkillsRoot, "own"));
        Environment.SetEnvironmentVariable("Chat__ReposRoot", "D:/pc/repos");
        Environment.SetEnvironmentVariable("Chat__BacklogHostRoot", "D:/pc/powerloom-backlog");
        Environment.SetEnvironmentVariable("Chat__AgentTools", AgentTools);
        // The run saga's waits, short enough for a test.
        Environment.SetEnvironmentVariable("Runner__BusyRetry", "00:00:01");
        Environment.SetEnvironmentVariable("Runner__TimeoutMargin", "00:00:02");

        // Schema first, as in production: Npgsql loads the type catalog (the enums) when the host first connects.
        await CreateAdoaTablesAsync();

        Host = await AlbaHost.For<Program>(web => web.ConfigureServices(AddProbes));
    }

    // The tests' own message, handler and cron lines; production ships no cron source until the features arrive.
    private static void AddProbes(IServiceCollection services)
    {
        services.AddSingleton<ProbeLog>();
        services.AddSingleton<FakeVaultCapture>();
        services.AddSingleton<FakeAdoClientFactory>();
        services.AddSingleton<IAdoClientFactory>(provider => provider.GetRequiredService<FakeAdoClientFactory>());
        services.AddSingleton<FakeConfluenceClientFactory>();
        services.AddSingleton<IConfluenceClientFactory>(provider => provider.GetRequiredService<FakeConfluenceClientFactory>());
        services.AddSingleton<IVaultCapture>(provider => provider.GetRequiredService<FakeVaultCapture>());
        services.AddSingleton<ICronSource, ProbeCronSource>();
        services.AddSingleton<FakeRunnerClient>();
        services.AddSingleton<IRunnerClient>(provider => provider.GetRequiredService<FakeRunnerClient>());
        services.AddSingleton<FakeSqlConnectionTester>();
        services.AddSingleton<ISqlConnectionTester>(provider => provider.GetRequiredService<FakeSqlConnectionTester>());
        services.AddSingleton<FakeLocalStackTester>();
        services.AddSingleton<ILocalStackTester>(provider => provider.GetRequiredService<FakeLocalStackTester>());
        services.AddSingleton<FakeAzureUserLogin>();
        services.AddSingleton<IAzureUserLogin>(provider => provider.GetRequiredService<FakeAzureUserLogin>());
        services.ConfigureWolverine(options =>
        {
            options.Discovery.IncludeType(typeof(VaultProbeHandler));
            // Auto mode writes generated code into the API project; the tests' probe handler must not land there.
            options.CodeGeneration.TypeLoadMode = TypeLoadMode.Dynamic;
            // Delayed messages (the saga's retry and timeout) are polled from the database; a test can't wait the default.
            options.Durability.ScheduledJobPollingTime = TimeSpan.FromSeconds(1);
            options.Durability.ScheduledJobFirstExecution = TimeSpan.FromSeconds(1);
        });
    }

    // One template with both placeholders, next to the vaults.
    private string WriteTemplates()
    {
        var home = Path.Combine(VaultsRoot, "..", "templates-" + Path.GetFileName(VaultsRoot));

        Directory.CreateDirectory(home);
        File.WriteAllText(Path.Combine(home, "AGENTS.md"), """
            # Rules

            This is the vault at {{vaultPath}}, created {{date}}.

            """);
        File.WriteAllText(Path.Combine(home, "POWERLOOM.md"), """
            # PowerLoom tools for {{vaultPath}}

            """);

        return home;
    }

    public async Task DisposeAsync()
    {
        await Host.DisposeAsync();
        await _postgres.DisposeAsync();
        Directory.Delete(VaultsRoot, recursive: true);
    }

    // The schema from PowerLoom's migrations (as in production), plus the one vault the tests use.
    private async Task CreateAdoaTablesAsync()
    {
        var options = new DbContextOptionsBuilder<PowerLoomDbContext>().UseNpgsql(_postgres.GetConnectionString(), npgsql => npgsql.MapPowerLoomEnums()).Options;
        await using var db = new PowerLoomDbContext(options);

        await db.Database.MigrateAsync();
        // The AgentConfig module's own schema (its PostgresAgentConfigStore creates it in production).
        await db.Database.ExecuteSqlRawAsync("CREATE SCHEMA IF NOT EXISTS agent_config; CREATE TABLE IF NOT EXISTS agent_config.agent (id text PRIMARY KEY, definition jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()); CREATE TABLE IF NOT EXISTS agent_config.global (id smallint PRIMARY KEY CHECK (id = 1), value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());");
        await db.Database.ExecuteSqlRawAsync("""INSERT INTO agent_config.agent (id, definition) VALUES ('vault-review', '{{"id":"vault-review","label":"Vault review","enabled":true,"next":null,"options":{{"staleDays":30}}}}') ON CONFLICT (id) DO NOTHING""");
        await db.Database.ExecuteSqlRawAsync("""INSERT INTO agent_config.agent (id, definition) VALUES ('research', '{{"id":"research","label":"Research","enabled":true,"schedule":"*/15 * * * *","next":"design","waitFor":["humanItems"],"limits":{{"timeoutMinutes":1}},"capabilities":{{"webAccess":false}},"options":{{"batchSize":2}}}}') ON CONFLICT (id) DO NOTHING""");
        await db.Database.ExecuteSqlRawAsync("""INSERT INTO agent_config.agent (id, definition) VALUES ('design', '{{"id":"design","label":"Design","enabled":true,"next":null,"waitFor":[],"limits":{{"timeoutMinutes":0}}}}') ON CONFLICT (id) DO NOTHING""");
        db.Vaults.Add(new Vault { Name = Vault, Features = "{}", CreatedAt = DateTime.UtcNow });

        await db.SaveChangesAsync();
    }
}
