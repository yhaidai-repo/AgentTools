using JasperFx;
using Wolverine.Attributes;

// Wolverine scans this assembly for handlers and HTTP endpoints, JasperFx for commands: the executable holds only
// Program.cs.
[assembly: WolverineModule]
[assembly: JasperFxAssembly]
