using DevSecrets.DevHub.Models;

namespace DevSecrets.DevHub;

public static class StackEndpoints
{
    public const string HealthPath = "/health";
    private const string StackPath = "/stack";
    private const int DefaultLogLines = 200;

    public static WebApplication MapStackEndpoints(this WebApplication app)
    {
        app.MapGet(HealthPath, () => TypedResults.Ok("ok"));
        app.MapGet("/services", (ServiceCatalog catalog) => TypedResults.Ok(catalog.GetServices()));
        app.MapGet(StackPath, (StackService stacks, CancellationToken cancellationToken) => stacks.GetStatusAsync(cancellationToken));
        app.MapPost(StackPath, StartAsync);
        app.MapDelete(StackPath, StopAsync);
        app.MapGet($"{StackPath}/logs/{{service}}", ReadLogAsync);
        app.MapGet("/repos/branch", FindBranchAsync);

        return app;
    }

    private static async Task<IResult> StartAsync(StartStackRequest request, StackService stacks, CancellationToken cancellationToken)
    {
        var result = await stacks.StartAsync(request, cancellationToken);

        if (!result.IsSuccess)
            return TypedResults.Problem(result.Error, statusCode: result.StatusCode);

        return TypedResults.Accepted(StackPath);
    }

    // Without ?owner= it stops any stack (a person at the console); with it, only that owner's or an unclaimed one.
    private static async Task<IResult> StopAsync(StackService stacks, StackOperationTracker tracker, string? owner = null)
    {
        // Not the request's token: a client that gives up must not leave a half-stopped stack.
        var result = await stacks.StopAsync(owner, CancellationToken.None);

        if (!result.IsSuccess)
            return TypedResults.Problem(result.Error, statusCode: result.StatusCode);

        return TypedResults.Ok(new { output = tracker.Output });
    }

    // A branch of a repo's checkout on this PC (PowerLoom's branch reviews of branches that aren't pushed).
    private static async Task<IResult> FindBranchAsync(string repo, string branch, LocalRepoBranches branches, CancellationToken cancellationToken)
    {
        var found = await branches.FindAsync(repo, branch, cancellationToken);

        if (!found.IsSuccess)
            return TypedResults.Problem(found.Error, statusCode: found.StatusCode);

        return TypedResults.Ok(found.Value);
    }

    private static async Task<IResult> ReadLogAsync(
        string service,
        StackService stacks,
        CancellationToken cancellationToken,
        int lines = DefaultLogLines,
        bool error = false
    )
    {
        var log = await stacks.ReadLogAsync(service, error, lines, cancellationToken);

        if (log is null)
            return TypedResults.Problem($"No {(error ? "error " : "")}log for '{service}' in the current stack.", statusCode: StatusCodes.Status404NotFound);

        return TypedResults.Ok(new { service, lines = log });
    }
}
