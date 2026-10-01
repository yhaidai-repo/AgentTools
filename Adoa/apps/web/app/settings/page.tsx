import { readAdoSettings, readSyncSettings } from "@adoa/core";
import { modelCatalog } from "@agenttools/config";
import { getAgentConfig } from "@/lib/agentConfig";
import { getDb } from "@/lib/db";
import { loadSprintOptions } from "@/lib/sprints";
import type { SprintOption } from "@/models/SprintOption";
import { AgentForm } from "./agents/AgentForm";
import { GlobalAgentForm } from "./agents/GlobalAgentForm";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = getDb();
  const ado = await readAdoSettings(db);
  const sync = await readSyncSettings(db);
  const sprints = await loadSprintOptions(ado);
  const sprintOptions: SprintOption[] | null =
    sprints?.map((sprint) => ({ path: sprint.path, label: `${sprint.path} (${sprint.timeFrame ?? "?"})` })) ?? null;
  const agentConfig = getAgentConfig();
  const agents = await agentConfig.list();
  const catalog = modelCatalog();

  return (
    <>
      <h1>Settings</h1>
      <SettingsForm ado={ado ?? { orgUrl: "", project: "", team: "", user: "" }} sync={sync} sprintOptions={sprintOptions} />
      <h2>Agents</h2>
      <GlobalAgentForm global={await agentConfig.getGlobal()} />
      {agents.map((agent) => <AgentForm key={agent.id} agent={agent} catalog={catalog} />)}
      {agents.length === 0 && <p className="muted">No agents yet: they appear once the agent-runner has started.</p>}
      <h2>From .env (restart to change)</h2>
      <p className="muted">
        Vault folder: <code>{process.env.VAULT_PATH ?? "not set"}</code> · ADO access token:{" "}
        {process.env.ADO_PAT ? "set" : "missing"}
      </p>
    </>
  );
}
