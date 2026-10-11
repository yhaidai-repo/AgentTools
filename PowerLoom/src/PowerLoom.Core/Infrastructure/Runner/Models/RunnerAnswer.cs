namespace PowerLoom.Infrastructure.Runner.Models;

// 202: the run starts now; 409: a run is in progress, ask again later. Anything else is an error.
public enum RunnerAnswer
{
    Accepted,
    Busy,
}
