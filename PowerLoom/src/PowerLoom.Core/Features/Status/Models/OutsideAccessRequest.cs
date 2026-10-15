namespace PowerLoom.Features.Status.Models;

// An open human task that asks a person to restore an agent's access to an outside resource (`data.accessRequest`).
public sealed record OutsideAccessRequest(string Id, string Title, string Kind, string Resource);
