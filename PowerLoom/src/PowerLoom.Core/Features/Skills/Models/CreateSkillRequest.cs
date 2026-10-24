namespace PowerLoom.Features.Skills.Models;

// A new skill of PowerLoom's own (user decision 2026-10-23: created with a new agent): its folder name and its SKILL.md.
public sealed record CreateSkillRequest(string Name, string Content);
