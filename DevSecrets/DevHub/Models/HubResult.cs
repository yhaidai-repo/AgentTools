namespace DevSecrets.DevHub.Models;

// Outcome of a stack command: expected failures (bad input, a stack already running) are results, not exceptions.
public sealed record HubResult(int StatusCode, string? Error)
{
    public bool IsSuccess => Error is null;

    public static HubResult Ok() => new(StatusCodes.Status200OK, null);

    public static HubResult Accepted() => new(StatusCodes.Status202Accepted, null);

    public static HubResult Invalid(string error) => new(StatusCodes.Status400BadRequest, error);

    public static HubResult Conflict(string error) => new(StatusCodes.Status409Conflict, error);

    public static HubResult NotFound(string error) => new(StatusCodes.Status404NotFound, error);

    public static HubResult Failed(string error) => new(StatusCodes.Status500InternalServerError, error);
}
