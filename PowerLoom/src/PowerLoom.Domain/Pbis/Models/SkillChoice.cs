namespace PowerLoom.Domain.Pbis.Models;

// A skill a person picks for a PBI's later agents, with why.
public sealed record SkillChoice(string Name, string Reason);
