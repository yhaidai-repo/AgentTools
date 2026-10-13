namespace DevSecrets.StackBridge.Models;

// Outcome of a stack command: expected failures (bad input, a stack already running) are results, not exceptions.
public sealed record BridgeResult(int StatusCode, string? Error)
{
    public bool IsSuccess => Error is null;

    public static BridgeResult Ok() => new(StatusCodes.Status200OK, null);

    public static BridgeResult Accepted() => new(StatusCodes.Status202Accepted, null);

    public static BridgeResult Invalid(string error) => new(StatusCodes.Status400BadRequest, error);

    public static BridgeResult Conflict(string error) => new(StatusCodes.Status409Conflict, error);
}
