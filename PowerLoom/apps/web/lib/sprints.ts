import { AdoClient, type AdoIteration } from "@powerloom/ado";
import { isAdoConfigured, type AdoSettings } from "@powerloom/core";
import type { SprintOption } from "@/models/SprintOption";

// Dated team sprints, newest first; null when ADO can't be reached, so the form falls back to a text field.
async function loadSprintOptions(ado: AdoSettings | null): Promise<AdoIteration[] | null> {
  if (!isAdoConfigured(ado)) {
    return null;
  }

  try {
    const client = new AdoClient({ orgUrl: ado.orgUrl, project: ado.project, team: ado.team, pat: ado.pat });
    const iterations = await client.getIterations(false);

    return iterations
      .filter((iteration) => iteration.startDate !== null)
      .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
  } catch {
    return null;
  }
}

// The sprint choices of the Settings and Backlog sync forms.
export async function loadSprintChoices(ado: AdoSettings | null): Promise<SprintOption[] | null> {
  const sprints = await loadSprintOptions(ado);

  return sprints?.map((sprint) => ({ path: sprint.path, label: `${sprint.path} (${sprint.timeFrame ?? "?"})` })) ?? null;
}
