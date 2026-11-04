namespace PowerLoom.Features.Flows.Engine;

// The ticker's catch-all for a running execution (a close the runner writes straight to the database leaves no hook
// behind): one advance, every minute, for every running execution.
public sealed record AdvanceFlowExecution(string ExecutionId);

public static class AdvanceFlowExecutionHandler
{
    public static Task Handle(AdvanceFlowExecution message, FlowAdvancer advancer, CancellationToken cancellation) => advancer.AdvanceAsync(message.ExecutionId, cancellation);
}
