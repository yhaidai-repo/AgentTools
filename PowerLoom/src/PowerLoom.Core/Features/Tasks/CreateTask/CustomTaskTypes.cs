using System.Text.RegularExpressions;
using PowerLoom.Features.Tasks.CreateTask.Models;
using PowerLoom.Infrastructure.AgentConfig;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Features.Tasks.CreateTask;

// Task types of their own that agents created in the UI handle (user decision 2026-10-24), e.g. "security-review": a
// kebab-case type some agent's `handles` lists and no built-in kind has. Such a task takes a PBI or none, comes in
// numbers, and is numbered XT with or without a PBI; its data is an agent task's (goal, repos), like research.
public sealed partial class CustomTaskTypes(AgentConfigReader agents)
{
    private const string Prefix = "XT";

    public async Task<IReadOnlyList<UserTaskType>> ListAsync(CancellationToken cancellation)
    {
        var all = await agents.ListAsync(cancellation);

        return all.SelectMany(agent => agent.Handles).Where(IsCustom).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).Select(TypeOf).ToList();
    }

    private static bool IsCustom(string name) => KebabCase().IsMatch(name) && !ItemKinds.IsBuiltIn(name);

    private static UserTaskType TypeOf(string name) => new(name, Kind: name, PbiUse.Optional, OnePerPbi: false, NoPbiPrefix: Prefix);

    [GeneratedRegex("^[a-z][a-z0-9-]*$")]
    private static partial Regex KebabCase();
}
