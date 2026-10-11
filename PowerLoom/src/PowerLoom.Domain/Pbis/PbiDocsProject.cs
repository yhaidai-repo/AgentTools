using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;

namespace PowerLoom.Domain.Pbis;

// The docs-vault project a PBI belongs to: the folder most of refinement's relevant docs are in ("pvs/…" → pvs).
public static class PbiDocsProject
{
    public const string NoProject = "common";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task<string> OfAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        var docs = await db.Refinements.AsNoTracking().Where(row => row.PbiId == adoId).OrderByDescending(row => row.Version).Select(row => row.RelevantDocs).FirstOrDefaultAsync(cancellation);
        var paths = docs is null ? [] : JsonSerializer.Deserialize<List<RelevantDocPath>>(docs, Json) ?? [];
        var folders = paths.Select(doc => doc.Path.Split('/')[0]).Where(folder => folder.Length > 0 && !folder.EndsWith(".md", StringComparison.OrdinalIgnoreCase)).ToList();

        return folders.GroupBy(folder => folder).OrderByDescending(group => group.Count()).Select(group => group.Key).FirstOrDefault() ?? NoProject;
    }

    private sealed record RelevantDocPath(string Path);
}
