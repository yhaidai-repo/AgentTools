namespace PowerLoom.Contracts.Imports;

// What the sync saw in one import source on its last run.
public sealed record ImportSourceStatus(string Source, int Waiting, int Failed);
