namespace PowerLoom.Features.Continue.Models;

// A skill the PBI's agents and chats use (the `work_item.skills` JSON).
public sealed record PbiSkill(string Name, string? Reason);
