using JasperFx;
using Wolverine.Attributes;

// Azure DevOps as its own library (user decision 2026-10-11): Wolverine scans it for handlers and endpoints, JasperFx
// for commands. Only the host references it.
[assembly: WolverineModule]
[assembly: JasperFxAssembly]
