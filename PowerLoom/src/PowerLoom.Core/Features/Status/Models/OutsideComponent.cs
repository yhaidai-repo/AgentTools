namespace PowerLoom.Features.Status.Models;

// An outside system on the scheme: its node, the runner's tool node that reads it, and the data access kinds it covers.
public sealed record OutsideComponent(string Component, string Tool, string[] Kinds);
