using Microsoft.EntityFrameworkCore;
using PowerLoom.Features.Status.Models;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Status.Probes;

// The agents' outside reads as the dashboard sees them: the open access requests (human tasks the runner wrote when a
// tool was refused) and the data access log's recent outside calls.
public sealed class OutsideAccessProbe(PowerLoomDbContext db)
{
    // How far back a call still says something about a system, and how many calls are read at most.
    private static readonly TimeSpan CallWindow = TimeSpan.FromDays(7);
    private const int MaxCalls = 2000;

    public async Task<OutsideAccessData> ReadAsync(DateTimeOffset now, CancellationToken cancellation)
    {
        return new OutsideAccessData(await OpenRequestsAsync(cancellation), await RecentCallsAsync(now, cancellation));
    }

    private Task<List<OutsideAccessRequest>> OpenRequestsAsync(CancellationToken cancellation)
    {
        return db.Database.SqlQuery<OutsideAccessRequest>($"""
            select id as "Id", title as "Title", data->'accessRequest'->>'kind' as "Kind", data->'accessRequest'->>'resource' as "Resource"
            from local_item
            where kind = 'human' and status in ('open', 'in-progress') and data->'accessRequest' is not null
            order by created_at
            """).ToListAsync(cancellation);
    }

    private Task<List<OutsideCall>> RecentCallsAsync(DateTimeOffset now, CancellationToken cancellation)
    {
        var since = now.Subtract(CallWindow).UtcDateTime;

        return db.Database.SqlQuery<OutsideCall>($"""
            select kind as "Kind", resource as "Resource", outcome as "Outcome", reason as "Reason", started_at as "StartedAt"
            from data_access
            where kind = any({OutsideComponents.Kinds}) and started_at >= {since}
            order by started_at desc
            limit {MaxCalls}
            """).ToListAsync(cancellation);
    }
}
