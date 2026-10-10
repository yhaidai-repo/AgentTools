using Alba;
using JasperFx.CodeGeneration;
using JasperFx.CommandLine;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using Testcontainers.PostgreSql;
using Wolverine;

namespace PowerLoom.Api.Tests;

// The API on a throwaway Postgres and a temp vaults folder, shared by a test class.
public sealed class PowerLoomHost : IAsyncLifetime
{
    public const string Vault = "test-vault";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16-alpine").Build();

    public IAlbaHost Host { get; private set; } = null!;

    public string VaultsRoot { get; } = Path.Combine(Path.GetTempPath(), "powerloom-tests", Guid.NewGuid().ToString("N"));

    public string VaultRoot => Path.Combine(VaultsRoot, Vault);

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        Directory.CreateDirectory(VaultRoot);
        // Program ends in RunJasperFxCommands: the test host must start the app instead of parsing commands.
        JasperFxEnvironment.AutoStartHost = true;

        // Environment variables are read after appsettings*.json, so they override the Development connection string;
        // config added through the test host lands before the files and loses.
        Environment.SetEnvironmentVariable("ConnectionStrings__PowerLoom", _postgres.GetConnectionString());
        Environment.SetEnvironmentVariable("Vaults__Root", VaultsRoot);

        // Schema first, as in production: Npgsql loads the type catalog (the enums) when the host first connects.
        await CreateAdoaTablesAsync();

        Host = await AlbaHost.For<Program>(web => web.ConfigureServices(AddProbes));
    }

    // The tests' own message, handler and cron lines; production ships no cron source until the features arrive.
    private static void AddProbes(IServiceCollection services)
    {
        services.AddSingleton<ProbeLog>();
        services.AddSingleton<ICronSource, ProbeCronSource>();
        services.ConfigureWolverine(options =>
        {
            options.Discovery.IncludeType(typeof(VaultProbeHandler));
            // Auto mode writes generated code into the API project; the tests' probe handler must not land there.
            options.CodeGeneration.TypeLoadMode = TypeLoadMode.Dynamic;
        });
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
        db.Vaults.Add(new Vault { Name = Vault, Features = "{}", CreatedAt = DateTime.UtcNow });

        await db.SaveChangesAsync();
    }
}
