using System.Threading.Channels;
using PowerLoom.Infrastructure.ErrorLog.Models;

namespace PowerLoom.Infrastructure.ErrorLog;

public sealed class ErrorLogProvider(Channel<PendingLogEntry> queue) : ILoggerProvider
{
    public ILogger CreateLogger(string categoryName) => new ErrorLogLogger(categoryName, queue.Writer);

    public void Dispose()
    {
    }
}
