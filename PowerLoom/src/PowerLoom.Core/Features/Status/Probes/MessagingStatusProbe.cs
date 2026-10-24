using Microsoft.EntityFrameworkCore;
using PowerLoom.Features.Status.Models;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Status.Probes;

// Wolverine's own tables in the `powerloom` schema, read directly: the inbox (waiting and scheduled messages) and the
// dead letters.
public sealed class MessagingStatusProbe(PowerLoomDbContext db)
{
    private const string IncomingStatus = "Incoming";
    private const string ScheduledStatus = "Scheduled";

    public async Task<MessagingStatus> ReadAsync(DateTimeOffset now, CancellationToken cancellation)
    {
        var byType = await db.Database.SqlQuery<TypeCount>($"select message_type as \"Type\", count(*)::int as \"Count\" from powerloom.wolverine_incoming_envelopes where status = {IncomingStatus} group by message_type").ToListAsync(cancellation);
        var scheduled = await db.Database.SqlQuery<int>($"select count(*)::int as \"Value\" from powerloom.wolverine_incoming_envelopes where status = {ScheduledStatus}").SingleAsync(cancellation);
        var deadLetters = await db.Database.SqlQuery<int>($"select count(*)::int as \"Value\" from powerloom.wolverine_dead_letters").SingleAsync(cancellation);
        var recent = await db.Database.SqlQuery<int>($"select count(*)::int as \"Value\" from powerloom.wolverine_dead_letters where sent_at >= {now.AddDays(-1)}").SingleAsync(cancellation);

        return new MessagingStatus(byType.Sum(entry => entry.Count), scheduled, deadLetters, recent, byType.ToDictionary(entry => entry.Type, entry => entry.Count));
    }

    private sealed record TypeCount(string Type, int Count);
}
