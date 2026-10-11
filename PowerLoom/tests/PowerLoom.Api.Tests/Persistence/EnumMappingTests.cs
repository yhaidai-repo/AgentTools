using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Persistence;

[Collection(PowerLoomCollection.Name)]
public sealed class EnumMappingTests(PowerLoomHost host)
{
    // PowerLoom's TypeScript side reads these columns as text: the labels must stay exactly its kebab-case strings.
    [Fact]
    public async Task Enum_members_are_stored_as_kebab_case_labels()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.WorkItems.Add(new WorkItem
        {
            AdoId = 424242,
            Type = "Product Backlog Item",
            Title = "enum round trip",
            AdoState = "New",
            ContentHash = "hash",
            Skills = "[]",
            ConfluencePages = "[]",
            Vault = PowerLoomHost.Vault,
            PipelineStatus = PipelineStatus.ReadyForDev,
            Source = WorkItemSource.Local,
        });

        await db.SaveChangesAsync();

        var labels = await db.Database.SqlQueryRaw<string>("SELECT pipeline_status::text || ' ' || source::text AS \"Value\" FROM work_item WHERE ado_id = 424242").ToListAsync();
        var read = await db.WorkItems.AsNoTracking().SingleAsync(item => item.AdoId == 424242);

        Assert.Equal(["ready-for-dev local"], labels);
        Assert.Equal(PipelineStatus.ReadyForDev, read.PipelineStatus);
    }
}
