namespace PowerLoom.Features.Skills.Models;

// `Changed` is false when the content was the same already. `RestoredFrom`: the restored revision's save time.
public sealed record SavedSkill(string Name, bool Changed, DateTime? RestoredFrom);
