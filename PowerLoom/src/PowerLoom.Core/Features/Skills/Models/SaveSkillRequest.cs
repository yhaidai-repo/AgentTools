namespace PowerLoom.Features.Skills.Models;

// `Hash`: the SHA-256 of the content the editor loaded, so a save never overwrites someone else's edit.
public sealed record SaveSkillRequest(string Content, string Hash);
