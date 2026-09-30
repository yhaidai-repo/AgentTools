const PBI_TYPES = "('Product Backlog Item', 'Bug')";

// One sprint at a time; empty states or user means no filter on that field.
export function sprintScopeQuery(project: string, iterationPath: string, states: string[], user: string): string {
  const conditions = [
    `[System.TeamProject] = ${quote(project)}`,
    `[System.WorkItemType] IN ${PBI_TYPES}`,
    `[System.IterationPath] = ${quote(iterationPath)}`,
    ...stateCondition(states),
    ...userCondition(user),
  ];

  return `SELECT [System.Id] FROM WorkItems WHERE ${conditions.join(" AND ")}`;
}

function stateCondition(states: string[]): string[] {
  return states.length > 0 ? [`[System.State] IN (${states.map(quote).join(", ")})`] : [];
}

function userCondition(user: string): string[] {
  return user ? [`[System.AssignedTo] = ${quote(user)}`] : [];
}

function quote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
