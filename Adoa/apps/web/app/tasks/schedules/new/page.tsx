import { newScheduleValues, producerOptions } from "@/lib/taskSchedules";
import { ScheduleForm } from "../ScheduleForm";

export const dynamic = "force-dynamic";

export default async function NewSchedulePage() {
  const producers = await producerOptions();

  return (
    <>
      <h1>New scheduled task</h1>
      <ScheduleForm values={newScheduleValues(producers)} producers={producers} />
    </>
  );
}
