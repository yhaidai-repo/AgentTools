namespace PowerLoom.Infrastructure.ErrorLog.Models;

// A warning or error the backend logged, waiting to be written to the error log.
public sealed record PendingLogEntry(string Level, string Message);
