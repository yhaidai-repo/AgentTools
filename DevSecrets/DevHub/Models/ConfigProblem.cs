namespace DevSecrets.DevHub.Models;

// Something the scripts would refuse (Level "error", from Use-DevSecrets.ps1 -Check) or worth a look ("warning").
public sealed record ConfigProblem(string Level, string Source, string Message);
