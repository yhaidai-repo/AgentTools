namespace PowerLoom.Features.Pbis.Close.Models;

// The PBIs to close or reopen, and who asks ("human" when left out).
public sealed record PbiIdsRequest(List<int> AdoIds, string? Actor);
