namespace PowerLoom.Domain.Tasks;

// Task types as AgentConfig names them (an agent's `handles`): the item kinds in the database, e.g. "vault-review".
// A type of its own an agent created in the UI handles is kept too (user decision 2026-10-24); AgentConfig has already
// checked each is kebab-case.
public static class TaskKinds
{
    public static IReadOnlyList<string> Parse(IEnumerable<string> labels) => labels.Distinct(StringComparer.Ordinal).ToList();
}
