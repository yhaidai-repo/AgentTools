import { readAdoSettings, readCurrentSprint, readSyncSettings } from "@adoa/core";
import Link from "next/link";
import { getAgentConfig } from "@/lib/agentConfig";
import { getDb } from "@/lib/db";
import { loadSprintChoices } from "@/lib/sprints";
import { GlobalAgentForm } from "./GlobalAgentForm";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = getDb();
  const ado = await readAdoSettings(db);
  const sync = await readSyncSettings(db);
  const sprintOptions = await loadSprintChoices(ado);

  return (
    <>
      <h1>Settings</h1>
      <SettingsForm ado={ado ?? { orgUrl: "", project: "", team: "", user: "" }} sync={sync} sprintOptions={sprintOptions} currentSprint={await readCurrentSprint(db)} />
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
