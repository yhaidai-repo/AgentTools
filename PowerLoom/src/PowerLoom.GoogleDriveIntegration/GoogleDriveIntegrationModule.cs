using JasperFx;
using Wolverine.Attributes;

// Google Drive as its own library, like Read SQL: Wolverine scans it for endpoints, JasperFx for commands. Only the host
// references it.
[assembly: WolverineModule]
[assembly: JasperFxAssembly]
