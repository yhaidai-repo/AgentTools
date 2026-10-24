import { enabledRepos } from "@powerloom/core";
import { loadCustomTaskTypes, userTaskTypes } from "@/lib/taskTypes";
import { Breadcrumbs } from "@/components/Breadcrumbs";
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
      <Breadcrumbs crumbs={[{ label: "Tasks", href: "/tasks" }, { label: "New task" }]} />
      <h1>New task</h1>
      <TaskForm values={NEW_TASK_VALUES} types={await userTaskTypes()} customTypes={await loadCustomTaskTypes()} repos={repos} />
    </>
  );
}
