using PowerLoom.Domain.Pbis.Models;

namespace PowerLoom.Features.Pbis.Skills.Models;

public sealed record SaveSkillsRequest(List<SkillChoice> Skills);
