import type { TaskWorkPort } from "@powerloom/core";
import { accepted } from "./accepted";
import type { PowerLoomClient } from "./createPowerLoomClient";
import { powerloomFailure } from "./powerloomFailure";

export function taskWorkPort(powerloom: PowerLoomClient): TaskWorkPort {
  return {
    async createTask(task, actor) {
      const { data, error, response } = await powerloom.POST("/api/tasks", { body: { ...task, actor } });

      return data ? { ok: true, value: { id: data.id, pbiId: data.pbiId ?? null } } : powerloomFailure(error, response);
    },
    async saveSchedule(schedule) {
      const { data, error, response } = await powerloom.PUT("/api/task-schedules", { body: schedule });

      return data ? { ok: true, value: { id: data.id, name: data.name, cron: data.cron, enabled: data.enabled } } : powerloomFailure(error, response);
    },
    async deleteSchedule(id) {
      return accepted(await powerloom.DELETE("/api/task-schedules/{id}", { params: { path: { id } } }));
    },
    async tickSchedule(id) {
      const { data, error, response } = await powerloom.POST("/api/task-schedules/{id}/tick", { params: { path: { id } } });

      return data ? { ok: true, value: data.result } : powerloomFailure(error, response);
    },
    async saveTaskNotes(itemId, text, loadedText) {
      const { data, error, response } = await powerloom.PUT("/api/items/{id}/user-notes", { params: { path: { id: itemId } }, body: { text, loadedText } });

      return data ? { ok: true, value: data.text } : powerloomFailure(error, response);
    },
  };
}
