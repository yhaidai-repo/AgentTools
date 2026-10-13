using DevSecrets.StackBridge.Models;

namespace DevSecrets.StackBridge;

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

        return app;
    }

    private static async Task<IResult> StartAsync(StartStackRequest request, StackService stacks, CancellationToken cancellationToken)
    {
        var result = await stacks.StartAsync(request, cancellationToken);

        if (!result.IsSuccess)
            return TypedResults.Problem(result.Error, statusCode: result.StatusCode);

        return TypedResults.Accepted(StackPath);
    }

    private static async Task<IResult> StopAsync(StackService stacks)
    {
        // Not the request's token: a client that gives up must not leave a half-stopped stack.
        var output = await stacks.StopAsync(CancellationToken.None);

        return TypedResults.Ok(new { output });
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
