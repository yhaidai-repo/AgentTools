namespace PowerLoom.Domain.Pbis.Models;

// An agent run still working on one of the PBIs asked about.
public sealed record RunningRun(long Id, int PbiId);
