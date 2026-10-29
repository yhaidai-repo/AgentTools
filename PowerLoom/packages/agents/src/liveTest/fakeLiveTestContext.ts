import type { CommandContext } from "@powerloom/core";

// A PBI as the backend reads it (PbiReference.Parse): its id, #id, or a link to it; "PBI-500" is none.
function pbiIdOf(reference: string): number | null {
  const match = [/^#?(\d+)$/, /workitems\/(?:edit\/)?(\d+)/i, /\/pbis\/(\d+)/, /[?&]id=(\d+)/].map((pattern) => pattern.exec(reference.trim())).find((found) => found !== null);

  return match ? Number(match[1]) : null;
}

// A PowerLoom that answers the live test's writes in memory and notes each call, for the liveTest tests.
// Reporting a bug queues a refinement task for it (R-<adoId>) the way the backend does; `queuesRefinement` false leaves
// it out.
export function fakeLiveTestContext(calls: string[], queuesRefinement = true): CommandContext {
  let nextId = 900;
  let refinements: { id: string; pbiId: number }[] = [];
  const queueRefinements = (adoIds: number[]) => refinements.push(...(queuesRefinement ? adoIds.map((adoId) => ({ id: `R-${adoId}`, pbiId: adoId })) : []));
  const done = (call: string, value: unknown = call) => (calls.push(call), Promise.resolve({ ok: true, value }));
  const powerloom = {
    createPbi: () => done("createPbi", { adoId: ++nextId }),
    reportBug: (input: { parent: string }) => {
      const parentId = pbiIdOf(input.parent);

      if (parentId === null) {
        return Promise.resolve({ ok: false, error: `Not a PBI link or id: ${input.parent}` });
      }

      const adoId = ++nextId;

      queueRefinements([adoId]);

      return done("reportBug", { adoId, parentId });
    },
    createTask: (task: { pbi: string }) => done("createTask", { id: `T-${++nextId}`, pbiId: Number(/(\d+)$/.exec(task.pbi)?.[1]) }),
    saveSchedule: (schedule: { id: number | null; name: string; cron: string; enabled: boolean }) => done("saveSchedule", { id: schedule.id ?? ++nextId, name: schedule.name, cron: schedule.cron, enabled: schedule.enabled }),
    savePbiUserNotes: (adoId: number, text: string) => done(`savePbiUserNotes ${adoId}`, text),
    deletePbi: (adoId: number) => done(`deletePbi ${adoId}`),
    deleteItem: (adoId: number | null, itemId: string) => {
      refinements = refinements.filter((task) => task.id !== itemId);

      return done(`deleteItem ${adoId} ${itemId}`);
    },
    stopTask: (itemId: string) => done(`stopTask ${itemId}`),
    editTask: (edit: { itemId: string }) => done(`editTask ${edit.itemId}`),
    deletePromptVersions: (agentId: string) => done(`deletePromptVersions ${agentId}`),
    deleteSchedule: (id: number) => done(`deleteSchedule ${id}`),
  };
  const agents = {
    get: async (id: string) => ({ id, label: id, origin: "user" }),
    remove: async (id: string) => void calls.push(`removeAgent ${id}`),
  };
  const db = { delete: () => ({ where: async () => {} }), select: () => ({ from: () => ({ where: async () => [...refinements] }) }) };

  return { db, actor: "agent:powerloom-selftest", powerloom, agents, skills: { names: async () => [] }, backlogMount: "/vault" } as unknown as CommandContext;
}
