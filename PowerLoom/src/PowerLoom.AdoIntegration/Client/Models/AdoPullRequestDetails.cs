namespace PowerLoom.AdoIntegration.Client.Models;

// What only per-PR calls return: how many times it was pushed to (ADO iterations) and the work items it links.
public sealed record AdoPullRequestDetails(int Iteration, IReadOnlyList<int> WorkItemIds);
