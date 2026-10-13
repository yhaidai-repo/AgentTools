import { USER_TASK_TYPES, enabledRepos } from "@powerloom/core";
import { NoVault } from "@/components/NoVault";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { NEW_TASK_VALUES } from "@/lib/taskSchedules";
import { TaskForm } from "./TaskForm";

export const dynamic = "force-dynamic";

// A new task belongs to the selected vault: its PBI, repositories and notes are the vault's.
export default async function NewTaskPage() {
  const vault = await currentVault();

  if (!vault) {
    return <NoVault title="New task" />;
  }

  const repos = (await enabledRepos(getDb(), vault)).map((row) => row.name);

  return (
    <>
      <h1>New task for {vault}</h1>
      <TaskForm values={NEW_TASK_VALUES} types={USER_TASK_TYPES} repos={repos} />
    </>
  );
}
