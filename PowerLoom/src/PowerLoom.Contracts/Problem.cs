namespace PowerLoom.Contracts;

// An expected failure (not found, invalid input, a refused change): a value the caller shows, never an exception.
public sealed record Problem(int Status, string Detail)
{
    public static Problem NotFound(string detail) => new(404, detail);

    public static Problem Invalid(string detail) => new(400, detail);

    public static Problem Conflict(string detail) => new(409, detail);
}
