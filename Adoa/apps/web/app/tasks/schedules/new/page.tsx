import { enabledRepos } from "@adoa/core";
import { NoVault } from "@/components/NoVault";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { agentChoices, newScheduleValues } from "@/lib/taskSchedules";
import { ScheduleForm } from "../ScheduleForm";

export const dynamic = "force-dynamic";

// A new schedule belongs to the selected vault: its agent works on the goal with the vault's enabled repositories.
export default async function NewSchedulePage() {
  const vault = await currentVault();

  if (!vault) {
    return <NoVault title="New scheduled task" />;
  }

  const agents = await agentChoices();

  return (
    <>
      <h1>New scheduled task for {vault}</h1>
      <ScheduleForm values={newScheduleValues(agents)} agents={agents} repos={(await enabledRepos(getDb(), vault)).map((row) => row.name)} />
    </>
  );
}
