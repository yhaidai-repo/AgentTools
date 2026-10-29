using Microsoft.AspNetCore.Mvc;
using Wolverine.Http;

namespace PowerLoom.Features.Status.Performance;

public static class PerformanceEndpoint
{
    [WolverineGet("/api/status/performance")]
    public static Task<PerformanceHistory> Get([FromServices] PerformanceStore store, TimeProvider clock, CancellationToken cancellation)
        => store.ReadAsync(clock.GetUtcNow().UtcDateTime, cancellation);
}
