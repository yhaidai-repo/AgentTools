namespace PowerLoom.Features.Skills;

// Shipped skills whose name changed, by their old name. The Demonstration agent's skill was called after "support guide"
// until 2026-10-30.
public static class RenamedSkills
{
    public static readonly IReadOnlyDictionary<string, string> Names = new Dictionary<string, string>
    {
        ["powerloom-support-guide"] = "powerloom-demonstration",
    };
}
