import { readTaskSchedule } from "@adoa/core";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { producerOptions } from "@/lib/taskSchedules";
import type { ScheduleFormValues } from "@/models/ScheduleFormValues";
import { ScheduleForm } from "../ScheduleForm";

export const dynamic = "force-dynamic";

export default async function EditSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const schedule = await readTaskSchedule(getDb(), Number((await params).id));

  if (!schedule) {
    notFound();
  }

  const values: ScheduleFormValues = {
    id: schedule.id,
    name: schedule.name,
    agentId: schedule.agentId,
    cron: schedule.cron,
    enabled: schedule.enabled,
    params: Object.fromEntries(Object.entries(schedule.params).map(([key, value]) => [key, Array.isArray(value) ? value.map(String) : []])),
  };

  return (
    <>
      <h1>Scheduled task: {schedule.name}</h1>
      <ScheduleForm values={values} producers={await producerOptions()} />
    </>
  );
}
