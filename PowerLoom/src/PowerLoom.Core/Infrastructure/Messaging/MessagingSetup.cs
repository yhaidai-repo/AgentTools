using JasperFx;
using JasperFx.Resources;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Persistence;
using Wolverine;
using Wolverine.EntityFrameworkCore;
using Wolverine.Http;
using Wolverine.Postgresql;

namespace PowerLoom.Infrastructure.Messaging;

public static class MessagingSetup
{
    // Wolverine's own tables live in their own schema, apart from adoa's.
    private const string WolverineSchema = "powerloom";

    // Postgres only: no broker. One vault's messages run one at a time; messages of different vaults in parallel.
    private const string VaultQueueName = "vault";
    private const int VaultQueueSlots = 4;

    public static WebApplicationBuilder AddPowerLoomMessaging(this WebApplicationBuilder builder)
    {
        var connectionString = builder.Configuration.GetConnectionString("PowerLoom")
            ?? throw new InvalidOperationException("ConnectionStrings:PowerLoom is not configured.");

        builder.Host.UseWolverine(options => ConfigureWolverine(options, connectionString));
        builder.Host.UseResourceSetupOnStartup();
        builder.Services.AddWolverineHttp();

        return builder;
    }

    private static void ConfigureWolverine(WolverineOptions options, string connectionString)
    {
        options.ServiceName = "PowerLoom";
        // One node: no leader election, every background agent runs here.
        options.Durability.Mode = DurabilityMode.Solo;

        options.PersistMessagesWithPostgresql(connectionString, WolverineSchema);
        options.Services.AddDbContextWithWolverineIntegration<PowerLoomDbContext>(db => db.UseNpgsql(connectionString), WolverineSchema);
        // Every local queue is backed by the inbox table: a queued message survives a restart.
        options.Policies.UseDurableLocalQueues();

        options.MessagePartitioning
            .ByMessage<IVaultScoped>(message => message.Vault)
            .PublishToPartitionedLocalMessaging(VaultQueueName, VaultQueueSlots, topology => topology.MessagesImplementing<IVaultScoped>());
    }
}
