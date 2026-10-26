namespace PowerLoom.Features.Tasks.StopTask.Models;

// The task whose run the runner is stopping; the run's own end (blocked, its partial result) follows in a moment.
public sealed record StoppedTask(string TaskId);
