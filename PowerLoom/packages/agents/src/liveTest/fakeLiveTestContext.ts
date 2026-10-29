import type { CommandContext } from "@powerloom/core";

// A PBI as the backend reads it (PbiReference.Parse): its id, #id, or a link to it; "PBI-500" is none.
function pbiIdOf(reference: string): number | null {
  const match = [/^#?(\d+)$/, /workitems\/(?:edit\/)?(\d+)/i, /\/pbis\/(\d+)/, /[?&]id=(\d+)/].map((pattern) => pattern.exec(reference.trim())).find((found) => found !== null);

  return match ? Number(match[1]) : null;
}

// A PowerLoom that answers the live test's writes in memory and notes each call, for the liveTest tests.
// Reporting a bug queues a refinement task for it (R-<adoId>) the way the backend does; `queuesRefinement` false leaves
// it out. The agents are an enabled one taking test tasks and a disabled one taking selftest-only; every item is of
// `itemKind`.
export function fakeLiveTestContext(calls: string[], queuesRefinement = true, itemKind = "test"): CommandContext {
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
    createTask: (task: { pbi: string }) => {
      const pbiId = pbiIdOf(task.pbi);

      return pbiId === null ? Promise.resolve({ ok: false, error: `Not a PBI link or id: ${task.pbi}` }) : done("createTask", { id: `T-${++nextId}`, pbiId });
    },
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
    rerunTask: (adoId: number | null, itemId: string) => done(`rerunTask ${adoId} ${itemId}`),
    deleteSchedule: (id: number) => done(`deleteSchedule ${id}`),
  };
  const agents = {
    get: async (id: string) => ({ id, label: id, origin: "user" }),
    list: async () => [{ id: "autotest", enabled: true, handles: ["test"] }, { id: "selftest-probe", enabled: false, handles: ["selftest-only"] }],
    remove: async (id: string) => void calls.push(`removeAgent ${id}`),
  };
  const rows = () => Object.assign(Promise.resolve([...refinements]), { limit: async () => [{ kind: itemKind }] });
  const db = { delete: () => ({ where: async () => {} }), select: () => ({ from: () => ({ where: rows }) }) };

  return { db, actor: "agent:powerloom-selftest", powerloom, agents, skills: { names: async () => [] }, backlogMount: "/vault" } as unknown as CommandContext;
}
