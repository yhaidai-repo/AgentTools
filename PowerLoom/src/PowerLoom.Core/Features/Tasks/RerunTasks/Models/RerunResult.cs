namespace PowerLoom.Features.Tasks.RerunTasks.Models;

// The tasks open again, and why the others weren't reopened.
public sealed record RerunResult(List<string> Reopened, List<string> Refused);
