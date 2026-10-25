using JasperFx;
using Wolverine.Attributes;

// GitHub as its own library, like Azure DevOps: Wolverine scans it for handlers and endpoints, JasperFx for commands.
// Only the host references it.
[assembly: WolverineModule]
[assembly: JasperFxAssembly]
