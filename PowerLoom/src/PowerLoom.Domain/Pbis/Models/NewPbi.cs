namespace PowerLoom.Domain.Pbis.Models;

// A PBI created in adoa (no ADO counterpart); `ParentId` makes it a child of that PBI.
public sealed record NewPbi(string Vault, string Title, string Type, int Priority, string? DescriptionMd, string? AcceptanceCriteriaMd, int? ParentId);
