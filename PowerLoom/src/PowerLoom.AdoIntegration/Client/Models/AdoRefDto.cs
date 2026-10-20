namespace PowerLoom.AdoIntegration.Client.Models;

// One git ref as ADO's refs API lists it: `refs/heads/<branch>` and the commit it points at.
internal sealed record AdoRefDto(string Name, string ObjectId);
