using Microsoft.AspNetCore.Mvc;
using PowerLoom.Features.Status.Models;
using Wolverine.Http;

namespace PowerLoom.Features.Status;

// The dashboard's Application tab: state, health and what needs attention, from PowerLoom's own data.
public static class StatusEndpoint
{
    [WolverineGet("/api/status")]
    public static Task<SystemStatus> Get([FromServices] SystemStatusReader reader, CancellationToken cancellation) => reader.ReadAsync(cancellation);
}
