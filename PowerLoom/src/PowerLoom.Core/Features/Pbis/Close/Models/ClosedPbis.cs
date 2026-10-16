namespace PowerLoom.Features.Pbis.Close.Models;

// One line per PBI: what was done to it, or why it was refused (an agent run on it, closed already, not in PowerLoom).
public sealed record ClosedPbis(List<string> Done, List<string> Refused);
