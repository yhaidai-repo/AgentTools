namespace DevSecrets.DevHub.Models;

// A command's value, or the expected failure instead (see HubResult).
public sealed record HubResult<T>(int StatusCode, string? Error, T? Value)
{
    public bool IsSuccess => Error is null;

    public static HubResult<T> Ok(T value) => new(StatusCodes.Status200OK, null, value);

    public static HubResult<T> From(HubResult failure) => new(failure.StatusCode, failure.Error, default);
}
