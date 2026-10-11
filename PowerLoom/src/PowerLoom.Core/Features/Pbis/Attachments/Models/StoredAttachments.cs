namespace PowerLoom.Features.Pbis.Attachments.Models;

// The new attachments' ids, in the files' order; the refs agents, the web and the vault use are `ATT-<id>`.
public sealed record StoredAttachments(List<int> Ids, List<string> Refs);
