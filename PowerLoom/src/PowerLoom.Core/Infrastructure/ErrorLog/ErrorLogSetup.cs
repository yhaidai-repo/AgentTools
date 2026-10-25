using System.Threading.Channels;
using Npgsql;
using PowerLoom.Infrastructure.ErrorLog.Models;

namespace PowerLoom.Infrastructure.ErrorLog;

public static class ErrorLogSetup
{
    // A flood of warnings drops the oldest queued ones instead of holding memory or blocking the caller.
    private const int QueueSize = 1000;

    public static WebApplicationBuilder AddPowerLoomErrorLog(this WebApplicationBuilder builder)
    {
        var connectionString = builder.Configuration.GetConnectionString("PowerLoom")
            ?? throw new InvalidOperationException("ConnectionStrings:PowerLoom is not configured.");
        var queue = Channel.CreateBounded<PendingLogEntry>(new BoundedChannelOptions(QueueSize) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true });

        builder.Services.AddSingleton(queue);
        builder.Services.AddSingleton(new ErrorLogStore(NpgsqlDataSource.Create(connectionString)));
        builder.Services.AddSingleton<ILoggerProvider, ErrorLogProvider>();
        builder.Services.AddHostedService<ErrorLogWriter>();

        return builder;
    }
}
