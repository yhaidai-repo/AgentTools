import { readAdoSettings, readSyncSettings } from "@adoa/core";
import Link from "next/link";
import { getAgentConfig } from "@/lib/agentConfig";
import { getDb } from "@/lib/db";
import { loadSprintOptions } from "@/lib/sprints";
import type { SprintOption } from "@/models/SprintOption";
import { GlobalAgentForm } from "./GlobalAgentForm";
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
      <GlobalAgentForm global={await getAgentConfig().getGlobal()} />
      <p className="muted">Per-agent settings (model, schedule, limits, budgets) are on the <Link href="/agents">Agents</Link> page: the Config button in each agent's row.</p>
      <h2>From .env (restart to change)</h2>
      <p className="muted">
        Vault folder: <code>{process.env.VAULT_PATH ?? "not set"}</code> · ADO access token:{" "}
        {process.env.ADO_PAT ? "set" : "missing"}
      </p>
    </>
  );
}
