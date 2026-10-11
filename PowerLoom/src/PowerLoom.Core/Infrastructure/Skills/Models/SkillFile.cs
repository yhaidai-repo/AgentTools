namespace PowerLoom.Infrastructure.Skills.Models;

// One skill's SKILL.md as found on disk (the first folder that has the skill, as the runner picks it).
public sealed record SkillFile(string Name, string Folder, string Path, string Content);
