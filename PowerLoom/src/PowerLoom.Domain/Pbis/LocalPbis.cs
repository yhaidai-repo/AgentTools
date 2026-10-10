using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Pbis.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Pbis;

// A local PBI: numbered from its own sequence (above every ADO id), state New, pipeline new like a synced one; the user
// prepares it for refinement as usual. A child starts from its parent's skills and repos.
public static class LocalPbis
{
    private const string LocalState = "New";

    public static async Task<int> CreateAsync(PowerLoomDbContext db, string actor, NewPbi input, CancellationToken cancellation)
    {
        var adoId = await db.Database.SqlQueryRaw<int>("select nextval('local_pbi_id')::int as \"Value\"").SingleAsync(cancellation);
        var row = new WorkItem
        {
            AdoId = adoId,
            Vault = input.Vault,
            Source = WorkItemSource.Local,
            Type = input.Type,
            Title = input.Title,
            AdoState = LocalState,
            Priority = input.Priority,
            Rev = 0,
            ContentHash = HashContent(input),
            DescriptionMd = input.DescriptionMd,
            AcceptanceCriteriaMd = input.AcceptanceCriteriaMd,
            PipelineStatus = PipelineStatus.New,
            ParentId = input.ParentId,
            Skills = "[]",
            ConfluencePages = "[]",
            SyncedAt = DateTime.UtcNow,
        };

        db.WorkItems.Add(row);
        PbiStatusChange.Set(db, row, null, PipelineStatus.New, actor, null);

        await db.SaveChangesAsync(cancellation);

        if (input.ParentId is not null)
            await PbiChildren.InheritParentContextAsync(db, adoId, input.ParentId.Value, cancellation);

        return adoId;
    }

    private static string HashContent(NewPbi input)
    {
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join("\n", input.Title, input.DescriptionMd ?? "", input.AcceptanceCriteriaMd ?? ""))));
    }
}
