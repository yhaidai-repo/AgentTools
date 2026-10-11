using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Features.Pbis.ConfluenceLinks.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using Wolverine.Http;

namespace PowerLoom.Features.Pbis.ConfluenceLinks;

// A Confluence page added to the PBI's attachments as a link (user decision 2026-10-02): listed for the later agents
// with why; not fetched. A page already listed keeps its entry (the user's wording wins); the user removes any entry,
// agent-added ones too.
public static class ConfluenceLinksEndpoints
{
    private const string User = "user";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    [WolverinePost("/api/pbis/{adoId}/confluence-links")]
    public static async Task<Results<Ok<List<PbiConfluencePage>>, ProblemHttpResult>> Add(int adoId, AddLinkRequest request, PowerLoomDbContext db, CancellationToken cancellation)
    {
        var url = request.Url.Trim();
        var problem = ConfluencePageLinks.Problem(url);

        if (problem is not null)
            return Problem.Invalid(problem).ToProblemResult();

        var pbi = await db.WorkItems.SingleOrDefaultAsync(row => row.AdoId == adoId, cancellation);

        if (pbi is null)
            return Problem.NotFound($"PBI-{adoId} isn't in PowerLoom.").ToProblemResult();

        var pages = Pages(pbi.ConfluencePages);

        if (pages.All(page => page.Url != url))
            pages.Add(new PbiConfluencePage(url, ConfluencePageLinks.TitleFromUrl(url), request.Why?.Trim() ?? "", User));

        pbi.ConfluencePages = JsonSerializer.Serialize(pages, Json);
        await db.SaveChangesAsync(cancellation);

        return TypedResults.Ok(pages);
    }

    [WolverineDelete("/api/pbis/{adoId}/confluence-links")]
    public static async Task<Results<Ok<List<PbiConfluencePage>>, ProblemHttpResult>> Remove(int adoId, RemoveLinkRequest request, PowerLoomDbContext db, CancellationToken cancellation)
    {
        var pbi = await db.WorkItems.SingleOrDefaultAsync(row => row.AdoId == adoId, cancellation);

        if (pbi is null)
            return Problem.NotFound($"PBI-{adoId} isn't in PowerLoom.").ToProblemResult();

        var pages = Pages(pbi.ConfluencePages).Where(page => page.Url != request.Url).ToList();

        pbi.ConfluencePages = JsonSerializer.Serialize(pages, Json);
        await db.SaveChangesAsync(cancellation);

        return TypedResults.Ok(pages);
    }

    private static List<PbiConfluencePage> Pages(string json) => string.IsNullOrWhiteSpace(json) ? [] : JsonSerializer.Deserialize<List<PbiConfluencePage>>(json, Json) ?? [];
}
