namespace PowerLoom.Infrastructure.Repos;

public sealed class ReposOptions
{
    public const string Section = "Repos";

    // The repos root (git checkouts) as mounted into the container; empty = not mounted, a local repo's folder isn't
    // checked then.
    public string Mount { get; set; } = "";
}
