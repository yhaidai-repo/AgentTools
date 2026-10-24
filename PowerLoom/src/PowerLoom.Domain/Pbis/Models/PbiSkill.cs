namespace PowerLoom.Domain.Pbis.Models;

// A skill later agents on a PBI load on top of their configured ones (the `work_item.skills` JSON): refinement
// recommends (`By` agent), the user edits (`By` user).
public sealed record PbiSkill(string Name, string Reason, string By);
