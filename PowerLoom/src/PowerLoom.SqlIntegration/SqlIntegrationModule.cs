using JasperFx;
using Wolverine.Attributes;

// Read SQL as its own library, like Confluence: Wolverine scans it for handlers and endpoints, JasperFx for commands.
// Only the host references it.
[assembly: WolverineModule]
[assembly: JasperFxAssembly]
