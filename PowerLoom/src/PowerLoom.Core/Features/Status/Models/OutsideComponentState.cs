namespace PowerLoom.Features.Status.Models;

// How an outside system looks from the agents' recent reads: the scheme node and its tool node, the state, and why.
// A system without recent reads or open requests isn't listed (the scheme shows it as off).
public sealed record OutsideComponentState(string Component, string Tool, StateLevel State, string Detail);
