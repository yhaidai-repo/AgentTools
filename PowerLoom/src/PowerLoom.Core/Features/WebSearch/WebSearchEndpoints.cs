using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Features.WebSearch.Models;
using PowerLoom.Infrastructure.Http;
using Wolverine.Http;

namespace PowerLoom.Features.WebSearch;

// Settings → Data access → Web search: one section for the whole PowerLoom, not per vault.
public static class WebSearchEndpoints
{
    [WolverineGet("/api/web-search")]
    public static Task<WebSearchSetting> Read(WebSearchConnection webSearch, CancellationToken cancellation) => webSearch.ReadAsync(cancellation);

    [WolverinePut("/api/web-search")]
    public static async Task<Results<Ok<WebSearchSetting>, ProblemHttpResult>> Save(SaveWebSearchRequest request, WebSearchConnection webSearch, CancellationToken cancellation)
    {
        var saved = await webSearch.SaveAsync(request, cancellation);

        return saved.Ok ? TypedResults.Ok(saved.Value) : saved.Problem.ToProblemResult();
    }
}
