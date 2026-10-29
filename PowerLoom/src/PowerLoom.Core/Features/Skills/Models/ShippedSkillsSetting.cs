namespace PowerLoom.Features.Skills.Models;

// The config row `skills:shipped`: one record per skill PowerLoom ships, by name.
public sealed record ShippedSkillsSetting(Dictionary<string, ShippedSkillRecord> Skills);
