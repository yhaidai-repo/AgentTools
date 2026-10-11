namespace PowerLoom.Features.Pbis.Create.Models;

// A PBI created in PowerLoom itself (no Azure DevOps counterpart). With `ParentId` it is a child item of that PBI, in the
// parent's vault (`Vault` may then be left out). `Actor` for status_history ("human", a CLI).
public sealed record CreatePbiRequest(string? Vault, string Title, string? Type, int? Priority, string? DescriptionMd, string? AcceptanceCriteriaMd, int? ParentId, string? Actor);
