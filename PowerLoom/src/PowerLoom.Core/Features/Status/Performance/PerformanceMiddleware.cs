using System.Diagnostics;

namespace PowerLoom.Features.Status.Performance;

public sealed class PerformanceMiddleware(RequestDelegate next, PerformanceAccumulator accumulator)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var started = Stopwatch.GetTimestamp();
        try { await next(context); }
        finally { accumulator.Record(Stopwatch.GetElapsedTime(started).TotalMilliseconds); }
    }
}
