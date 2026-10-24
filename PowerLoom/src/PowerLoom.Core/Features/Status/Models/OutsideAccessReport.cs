namespace PowerLoom.Features.Status.Models;

// The outside-access rules' answer: a state per outside system, and what needs attention.
public sealed record OutsideAccessReport(List<OutsideComponentState> States, List<Attention> Attention);
