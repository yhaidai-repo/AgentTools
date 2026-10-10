using Alba;
using JasperFx.CommandLine;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;
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

        Host = await AlbaHost.For<Program>(web => web.ConfigureServices(AddProbes));

        await CreateAdoaTablesAsync();
    }

    // The tests' own message, handler and cron lines; production ships no cron source until the features arrive.
    private static void AddProbes(IServiceCollection services)
    {
        services.AddSingleton<ProbeLog>();
        services.AddSingleton<ICronSource, ProbeCronSource>();
        services.ConfigureWolverine(options => options.Discovery.IncludeType(typeof(VaultProbeHandler)));
    }

    public async Task DisposeAsync()
    {
        await Host.DisposeAsync();
        await _postgres.DisposeAsync();
        Directory.Delete(VaultsRoot, recursive: true);
    }

    // adoa's tables that PowerLoom maps (drizzle creates them in production), plus the one vault the tests use.
    private async Task CreateAdoaTablesAsync()
    {
        using var scope = Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await db.Database.ExecuteSqlRawAsync(db.Database.GenerateCreateScript());
        db.Vaults.Add(new VaultRow { Name = Vault, Features = "{}", CreatedAt = DateTimeOffset.UtcNow });

        await db.SaveChangesAsync();
    }
}
