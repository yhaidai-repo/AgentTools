using PowerLoom.AdoIntegration.Client;

namespace PowerLoom.Api.Tests.Ado;

public sealed class WiqlTests
{
    [Fact]
    public void The_sprint_scope_filters_type_sprint_and_optionally_states_and_user()
    {
        var query = Wiql.SprintScope("Proj", "Proj\\Sprint 7", ["New", "Committed"], "sam@x.io");

        Assert.Equal("SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = 'Proj' AND [System.WorkItemType] IN ('Product Backlog Item', 'Bug') AND [System.IterationPath] = 'Proj\\Sprint 7' AND [System.State] IN ('New', 'Committed') AND [System.AssignedTo] = 'sam@x.io'", query);
    }

    [Fact]
    public void Quotes_are_doubled_and_empty_filters_are_left_out()
    {
        var query = Wiql.SprintTasks("O'Brien", "O'Brien\\S1", "");

        Assert.Equal("SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = 'O''Brien' AND [System.WorkItemType] = 'Task' AND [System.IterationPath] = 'O''Brien\\S1'", query);
    }
}
