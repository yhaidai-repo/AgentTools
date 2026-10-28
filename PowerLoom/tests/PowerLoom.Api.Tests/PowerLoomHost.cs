using PowerLoom.Features.AiProviders;
using PowerLoom.Infrastructure.ChatLaunch;
using PowerLoom.Infrastructure.LocalBranches;
using Alba;
using JasperFx.CodeGeneration;
using JasperFx.CommandLine;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.AdoIntegration.Client;
using PowerLoom.GitHubIntegration.Client;
using PowerLoom.GoogleDriveIntegration.Client;
using PowerLoom.AzureIntegration.Features.Resources;
using PowerLoom.ConfluenceIntegration.Client;
using PowerLoom.Infrastructure.Runner;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Infrastructure.VaultCapture;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.DevHubIntegration.Features.BrowserArtefacts;
using PowerLoom.DevHubIntegration.Features.DevHub;
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
    public string DesktopRoot => Path.Combine(VaultsRoot, "desktop");

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
        Environment.SetEnvironmentVariable("Mcp__Url", "http://127.0.0.1:3110/mcp");
        Environment.SetEnvironmentVariable("Mcp__Token", "test-token");
        Environment.SetEnvironmentVariable("Backlog__Root", BacklogRoot);
        Environment.SetEnvironmentVariable("Import__InboxRoot", ImportRoot);
        Environment.SetEnvironmentVariable("Repos__Mount", ReposRoot);
        Environment.SetEnvironmentVariable("Skills__Folders__0", Path.Combine(SkillsRoot, "own"));
        Environment.SetEnvironmentVariable("Skills__Folders__1", Path.Combine(SkillsRoot, "other"));
        Environment.SetEnvironmentVariable("Skills__Editable", Path.Combine(SkillsRoot, "own"));
        Environment.SetEnvironmentVariable("Chat__ReposRoot", "D:/pc/repos");
        Environment.SetEnvironmentVariable("Chat__BacklogHostRoot", "D:/pc/powerloom-backlog");
        Environment.SetEnvironmentVariable("Chat__AgentTools", AgentTools);
        Environment.SetEnvironmentVariable("Chat__CodexHistoryRoot", Path.Combine(DesktopRoot, "codex"));
        Environment.SetEnvironmentVariable("Chat__ClaudeSessionsRoot", Path.Combine(DesktopRoot, "claude"));
        Directory.CreateDirectory(Path.Combine(DesktopRoot, "codex", "sessions"));
        Directory.CreateDirectory(Path.Combine(DesktopRoot, "claude"));
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
        services.AddSingleton<FakeLocalBranches>();
        services.AddSingleton<ILocalBranches>(provider => provider.GetRequiredService<FakeLocalBranches>());
        services.AddSingleton<IAdoClientFactory>(provider => provider.GetRequiredService<FakeAdoClientFactory>());
        services.AddSingleton<FakeGitHubClientFactory>();
        services.AddSingleton<IGitHubClientFactory>(provider => provider.GetRequiredService<FakeGitHubClientFactory>());
        services.AddSingleton<FakeGoogleApi>();
        services.AddSingleton<IGoogleApi>(provider => provider.GetRequiredService<FakeGoogleApi>());
        services.AddSingleton<FakeConfluenceClientFactory>();
        services.AddSingleton<IConfluenceClientFactory>(provider => provider.GetRequiredService<FakeConfluenceClientFactory>());
        services.AddSingleton<IVaultCapture>(provider => provider.GetRequiredService<FakeVaultCapture>());
        services.AddSingleton<ICronSource, ProbeCronSource>();
        services.AddSingleton<FakeRunnerClient>();
        services.AddSingleton<IRunnerClient>(provider => provider.GetRequiredService<FakeRunnerClient>());
        services.AddSingleton<FakeSqlConnectionTester>();
        services.AddSingleton<ISqlConnectionTester>(provider => provider.GetRequiredService<FakeSqlConnectionTester>());
        services.AddSingleton<FakeDevHubTester>();
        services.AddSingleton<IDevHubTester>(provider => provider.GetRequiredService<FakeDevHubTester>());
        services.AddSingleton<FakeDevHubBrowserArtefacts>();
        services.AddSingleton<IDevHubBrowserArtefacts>(provider => provider.GetRequiredService<FakeDevHubBrowserArtefacts>());
        services.AddSingleton<IChatLauncher, ProbeChatLauncher>();
        services.AddSingleton<FakeCodexLogin>();
        services.AddSingleton<ICodexLogin>(provider => provider.GetRequiredService<FakeCodexLogin>());
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
        // The AgentUsage module's schema (its PostgresUsageStore creates it in production): the cleanup prunes run_event.
        await db.Database.ExecuteSqlRawAsync("CREATE SCHEMA IF NOT EXISTS agent_usage; CREATE TABLE IF NOT EXISTS agent_usage.usage_record (run_id text PRIMARY KEY, labels jsonb NOT NULL, started_at timestamptz NOT NULL, ended_at timestamptz NOT NULL, duration_ms integer NOT NULL, turns integer NOT NULL, outcome text NOT NULL, error text, input_tokens bigint NOT NULL, output_tokens bigint NOT NULL, cache_read_tokens bigint NOT NULL, cache_write_tokens bigint NOT NULL, cost_usd numeric(14, 6) NOT NULL, provider_cost_usd numeric(14, 6), models jsonb NOT NULL, subscription jsonb NOT NULL DEFAULT '[]'); CREATE TABLE IF NOT EXISTS agent_usage.run_event (run_id text NOT NULL, seq integer NOT NULL, at timestamptz NOT NULL, type text NOT NULL, payload jsonb NOT NULL, PRIMARY KEY (run_id, seq));");
        await db.Database.ExecuteSqlRawAsync("""INSERT INTO agent_config.agent (id, definition) VALUES ('vault-review', '{{"id":"vault-review","label":"Vault review","enabled":true,"next":null,"options":{{"staleDays":30}}}}') ON CONFLICT (id) DO NOTHING""");
        await db.Database.ExecuteSqlRawAsync("""INSERT INTO agent_config.agent (id, definition) VALUES ('research', '{{"id":"research","label":"Research","enabled":true,"schedule":"*/15 * * * *","next":"design","waitFor":["humanItems"],"limits":{{"timeoutMinutes":1}},"capabilities":{{"webAccess":false}},"options":{{"batchSize":2}}}}') ON CONFLICT (id) DO NOTHING""");
        await db.Database.ExecuteSqlRawAsync("""INSERT INTO agent_config.agent (id, definition) VALUES ('design', '{{"id":"design","label":"Design","enabled":true,"next":null,"waitFor":[],"limits":{{"timeoutMinutes":0}}}}') ON CONFLICT (id) DO NOTHING""");
        db.Vaults.Add(new Vault { Name = Vault, Features = "{}", CreatedAt = DateTime.UtcNow });

        await db.SaveChangesAsync();
    }
}
