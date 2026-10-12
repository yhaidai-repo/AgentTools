using JasperFx;
using Wolverine.Attributes;

// Read Azure as its own library, like Read SQL: Wolverine scans it for handlers and endpoints, JasperFx for commands.
// Only the host references it.
[assembly: WolverineModule]
[assembly: JasperFxAssembly]
