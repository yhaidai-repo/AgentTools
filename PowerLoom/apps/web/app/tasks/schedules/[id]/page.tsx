import { USER_TASK_TYPES, enabledRepos, readTaskSchedule } from "@powerloom/core";
import { notFound } from "next/navigation";
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
      <h1>Scheduled task: {schedule.name} ({schedule.vault})</h1>
      <TaskForm values={taskScheduleValues(schedule)} types={USER_TASK_TYPES} repos={repos} />
    </>
  );
}
