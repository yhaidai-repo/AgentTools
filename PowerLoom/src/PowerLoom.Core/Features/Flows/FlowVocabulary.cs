namespace PowerLoom.Features.Flows;

// The words of a flow row and its executions, as the TypeScript side spells them (packages/core/src/models/FlowDefinition.ts).
public static class FlowStatuses
{
    public const string Running = "running";

    public const string Done = "done";

    public const string Failed = "failed";

    public const string Cancelled = "cancelled";
}

public static class FlowTargetKinds
{
    public const string Pbi = "pbi";

    public const string Task = "task";
}

public static class FlowNodeTypes
{
    public const string Trigger = "trigger";

    public const string Agent = "agent";

    // The trigger node's fixed id (the canvas keeps one, TRIGGER_NODE_ID in TypeScript).
    public const string TriggerId = "trigger";
}

public static class FlowEdgeKinds
{
    public const string Required = "required";

    public const string Optional = "optional";
}
