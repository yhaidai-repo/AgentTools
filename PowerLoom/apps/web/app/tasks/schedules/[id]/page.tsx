import { USER_TASK_TYPES, enabledRepos, readTaskSchedule } from "@powerloom/core";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getDb } from "@/lib/db";
import { agentChoices, scheduleValues, taskScheduleValues } from "@/lib/taskSchedules";
import { TaskForm } from "../../new/TaskForm";
import { ScheduleForm } from "../ScheduleForm";

export const dynamic = "force-dynamic";

// A schedule by task type opens the task form it was saved with; an agent's schedule its own form.
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
      {schedule.taskType
        ? <TaskForm values={taskScheduleValues(schedule)} types={USER_TASK_TYPES} repos={repos} />
        : <ScheduleForm values={scheduleValues(schedule)} agents={await agentChoices(schedule.agentId)} repos={repos} />}
    </>
  );
}
