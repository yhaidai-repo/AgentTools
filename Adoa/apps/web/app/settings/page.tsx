import { readAdoSettings, readAgentSettings, readSyncSettings } from "@adoa/core";
import { getDb } from "@/lib/db";
import { loadSprintOptions } from "@/lib/sprints";
import type { SprintOption } from "@/models/SprintOption";
import { AgentSettingsForm } from "./AgentSettingsForm";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = getDb();
  const ado = await readAdoSettings(db);
  const sync = await readSyncSettings(db);
  const sprints = await loadSprintOptions(ado);
  const sprintOptions: SprintOption[] | null =
    sprints?.map((sprint) => ({ path: sprint.path, label: `${sprint.path} (${sprint.timeFrame ?? "?"})` })) ?? null;

  return (
    <>
      <h1>Settings</h1>
      <SettingsForm ado={ado ?? { orgUrl: "", project: "", team: "", user: "" }} sync={sync} sprintOptions={sprintOptions} />
      <h2>Agents</h2>
      <AgentSettingsForm settings={await readAgentSettings(db)} />
      <h2>From .env (restart to change)</h2>
      <p className="muted">
        Vault folder: <code>{process.env.VAULT_PATH ?? "not set"}</code> · ADO access token:{" "}
        {process.env.ADO_PAT ? "set" : "missing"}
      </p>
    </>
  );
}
