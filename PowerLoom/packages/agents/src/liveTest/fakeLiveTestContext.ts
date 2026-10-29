import type { CommandContext } from "@powerloom/core";

// A PowerLoom that answers the live test's writes in memory and notes each call, for the liveTest tests.
// Preparing queues a refinement task (R-<adoId>) the way the backend does; `queuesRefinement` false leaves it out.
export function fakeLiveTestContext(calls: string[], queuesRefinement = true): CommandContext {
  let nextId = 900;
  let refinements: { id: string; pbiId: number }[] = [];
  const done = (call: string, value: unknown = call) => (calls.push(call), Promise.resolve({ ok: true, value }));
  const powerloom = {
    createPbi: () => done("createPbi", { adoId: ++nextId }),
    reportBug: (input: { parent: string }) => done("reportBug", { adoId: ++nextId, parentId: Number(input.parent) }),
    createTask: (task: { pbi: string }) => done("createTask", { id: `T-${++nextId}`, pbiId: Number(/(\d+)$/.exec(task.pbi)?.[1]) }),
    saveSchedule: (schedule: { id: number | null; name: string; cron: string; enabled: boolean }) => done("saveSchedule", { id: schedule.id ?? ++nextId, name: schedule.name, cron: schedule.cron, enabled: schedule.enabled }),
    savePbiUserNotes: (adoId: number, text: string) => done(`savePbiUserNotes ${adoId}`, text),
    deletePbi: (adoId: number) => done(`deletePbi ${adoId}`),
    deleteItem: (adoId: number | null, itemId: string) => {
      refinements = refinements.filter((task) => task.id !== itemId);

      return done(`deleteItem ${adoId} ${itemId}`);
    },
    preparePbis: (adoIds: number[]) => {
      refinements.push(...(queuesRefinement ? adoIds.map((adoId) => ({ id: `R-${adoId}`, pbiId: adoId })) : []));

      return done(`preparePbis ${adoIds.join(",")}`, { queued: adoIds, closed: [], unknown: [] });
    },
    deleteSchedule: (id: number) => done(`deleteSchedule ${id}`),
  };
  const agents = {
    get: async (id: string) => ({ id, label: id, origin: "user" }),
    remove: async (id: string) => void calls.push(`removeAgent ${id}`),
  };
  const db = { delete: () => ({ where: async () => {} }), select: () => ({ from: () => ({ where: async () => [...refinements] }) }) };

  return { db, actor: "agent:powerloom-selftest", powerloom, agents, skills: { names: async () => [] }, backlogMount: "/vault" } as unknown as CommandContext;
}
