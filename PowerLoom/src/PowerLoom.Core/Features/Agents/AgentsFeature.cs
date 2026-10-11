using PowerLoom.Features.Agents.AgentRun;
using PowerLoom.Features.Agents.Dispatch;
using PowerLoom.Infrastructure.Scheduling;
using Wolverine;

namespace PowerLoom.Features.Agents;

// Dispatching the agents: their schedules, the validator and the run saga; the runner itself stays TypeScript.
public static class AgentsFeature
{
    // One dispatch at a time (claims in order) and one request to the runner at a time (it runs one task).
    private const string DispatchQueue = "dispatch";
    private const string RunnerQueue = "runner";

    public static IServiceCollection AddAgentsFeature(this IServiceCollection services)
    {
        services.AddSingleton<ICronSource, AgentCronSource>();
        services.ConfigureWolverine(options =>
        {
            options.PublishMessage<DispatchAgent>().ToLocalQueue(DispatchQueue);
            options.LocalQueue(DispatchQueue).Sequential();
            options.PublishMessage<StartAgentRun>().ToLocalQueue(RunnerQueue);
            options.LocalQueue(RunnerQueue).Sequential();
        });

        return services;
    }
}
