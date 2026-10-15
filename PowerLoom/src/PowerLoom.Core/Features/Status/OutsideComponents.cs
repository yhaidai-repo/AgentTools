using PowerLoom.Features.Status.Models;

namespace PowerLoom.Features.Status;

// Which scheme nodes the data access kinds belong to (the web's architecture scheme spells the same ids).
public static class OutsideComponents
{
    public static readonly IReadOnlyList<OutsideComponent> All =
    [
        new("sql-server", "tool-sql", ["sql"]),
        new("azure", "tool-azure", ["azure", "cosmos", "serviceBus"]),
        new("mongo", "tool-mongo", ["mongo"]),
        new("devhub", "tool-devhub", ["localStack"]),
        new("confluence", "tool-confluence", ["confluence"]),
        new("ado", "tool-ado", ["ado"]),
    ];

    public static readonly string[] Kinds = All.SelectMany(component => component.Kinds).ToArray();

    public static OutsideComponent? Of(string kind) => All.FirstOrDefault(component => component.Kinds.Contains(kind));
}
