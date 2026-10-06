import { enabledRepos, readTaskSchedule } from "@adoa/core";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { agentChoices, scheduleValues } from "@/lib/taskSchedules";
import { ScheduleForm } from "../ScheduleForm";

export const dynamic = "force-dynamic";

export default async function EditSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const schedule = await readTaskSchedule(getDb(), Number((await params).id));

  if (!schedule) {
    notFound();
  }

  return (
    <>
      <h1>Scheduled task: {schedule.name} ({schedule.vault})</h1>
      <ScheduleForm values={scheduleValues(schedule)} agents={await agentChoices(schedule.agentId)} repos={(await enabledRepos(getDb(), schedule.vault)).map((row) => row.name)} />
    </>
  );
}
