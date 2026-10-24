import { enabledRepos, readTaskSchedule } from "@powerloom/core";
import { loadCustomTaskTypes, userTaskTypes } from "@/lib/taskTypes";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getDb } from "@/lib/db";
import { taskScheduleValues } from "@/lib/taskSchedules";
import { TaskForm } from "../../new/TaskForm";

export const dynamic = "force-dynamic";

// A schedule opens the task form it was saved with.
export default async function EditSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const schedule = await readTaskSchedule(getDb(), Number((await params).id));

  if (!schedule) {
    notFound();
  }

  const repos = (await enabledRepos(getDb(), schedule.vault)).map((row) => row.name);

  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Tasks", href: "/tasks" }, { label: schedule.name }]} />
      <h1>Scheduled task: {schedule.name}</h1>
      <TaskForm values={taskScheduleValues(schedule)} types={await userTaskTypes()} customTypes={await loadCustomTaskTypes()} repos={repos} />
    </>
  );
}
