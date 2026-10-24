import { parsePbiReference } from "@powerloom/core";
import type { LiveTestEntity } from "./models/LiveTestEntity";
import type { LiveTestTarget } from "./models/LiveTestTarget";

// The targets and entities the live-test rules name, from the commands' inputs and results.

export function pbiTarget(adoId: number | null | undefined): LiveTestTarget[] {
  return adoId === null || adoId === undefined ? [] : [{ kind: "pbi", id: String(adoId) }];
}

// A PBI named as a link, #id, id or PBI-id (as agents write it); text that names none stays a target no run owns, so
// the call is refused.
export function pbiReferenceTarget(reference: string | null | undefined): LiveTestTarget[] {
  if (!reference) {
    return [];
  }

  const adoId = parsePbiReference(reference.trim().replace(/^PBI-/i, ""));

  return [{ kind: "pbi", id: adoId === null ? reference : String(adoId) }];
}

export function itemTarget(itemId: string | null | undefined): LiveTestTarget[] {
  return itemId ? [{ kind: "item", id: itemId }] : [];
}

export function scheduleTarget(id: number | null | undefined): LiveTestTarget[] {
  return id === null || id === undefined ? [] : [{ kind: "schedule", id: String(id) }];
}

export function agentTarget(id: string): LiveTestTarget[] {
  return [{ kind: "agent", id }];
}

export function pbiEntity(adoId: number, parentId: number | null = null): LiveTestEntity[] {
  return [{ kind: "pbi", id: String(adoId), pbiId: parentId }];
}

export function taskEntity(itemId: string | null, pbiId: number | null): LiveTestEntity[] {
  return itemId === null ? [] : [{ kind: "task", id: itemId, pbiId }];
}

export function scheduleEntity(id: number | null): LiveTestEntity[] {
  return id === null ? [] : [{ kind: "schedule", id: String(id) }];
}

export function agentEntity(id: string): LiveTestEntity[] {
  return [{ kind: "agent", id }];
}

/** How a refusal names a target: PBI-38519, Q-38519-002, schedule 7, agent selftest-probe. */
export function targetLabel(target: LiveTestTarget): string {
  const labels: Record<LiveTestTarget["kind"], string> = { pbi: `PBI-${target.id}`, item: target.id, schedule: `schedule ${target.id}`, agent: `agent ${target.id}` };

  return labels[target.kind];
}
