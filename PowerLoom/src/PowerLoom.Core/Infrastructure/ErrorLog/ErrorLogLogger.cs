using System.Threading.Channels;
using PowerLoom.Infrastructure.ErrorLog.Models;

namespace PowerLoom.Infrastructure.ErrorLog;

// Queues the backend's warnings and errors for the error log; the writer saves them in the background, so logging never
// waits on the database.
public sealed class ErrorLogLogger(string category, ChannelWriter<PendingLogEntry> queue) : ILogger
{
    // The database's own logs would log again while their entry is written; the writer's own category is left out too.
    private static readonly string[] Unlogged = ["Microsoft.EntityFrameworkCore", "Npgsql", typeof(ErrorLogLogger).Namespace!];

    public IDisposable? BeginScope<TState>(TState state)
        where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Warning && logLevel != LogLevel.None && !Unlogged.Any(category.StartsWith);

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
        if (!IsEnabled(logLevel))
            return;

        var message = exception is null ? formatter(state, null) : $"{formatter(state, exception)}\n{exception}";

        queue.TryWrite(new PendingLogEntry(logLevel == LogLevel.Warning ? "warn" : "error", $"{category}: {message}"));
    }
}
