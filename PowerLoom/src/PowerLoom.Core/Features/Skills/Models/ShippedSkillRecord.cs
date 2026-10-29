namespace PowerLoom.Features.Skills.Models;

// How a start last applied one shipped skill: the shipped text's hash, when, and the revision keeping the edited text it
// replaced (null when the folder already had the shipped text). Read by core's loadShippedSkill for the skill's page.
public sealed record ShippedSkillRecord(string Hash, DateTime AppliedAt, int? ReplacedRevisionId);
