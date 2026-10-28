namespace PowerLoom.Domain.Tasks.Models;

// A closed dependency a hand-off gates (`handoff.gate` approve or answer): how its target closed and the person's answer.
public sealed record GatedDependency(string ItemId, string Gate, string Status, string? Resolution);
