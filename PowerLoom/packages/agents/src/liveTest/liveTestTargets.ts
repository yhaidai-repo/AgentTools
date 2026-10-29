import { parsePbiReference } from "@powerloom/core";
import type { LiveTestEntity } from "./models/LiveTestEntity";
import type { LiveTestTarget } from "./models/LiveTestTarget";

// The targets and entities the live-test rules name, from the commands' inputs and results.

export function pbiTarget(adoId: number | null | undefined): LiveTestTarget[] {
  return adoId === null || adoId === undefined ? [] : [{ kind: "pbi", id: String(adoId) }];
}

// A PBI named as a link, #id or id, as the backend reads it (PBI-500 names none there); text that names none is a
// reference target no run owns, so the call is refused.
export function pbiReferenceTarget(reference: string | null | undefined): LiveTestTarget[] {
  if (!reference) {
    return [];
  }

  const adoId = parsePbiReference(reference);

  return [adoId === null ? { kind: "reference", id: reference } : { kind: "pbi", id: String(adoId) }];
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

/** Why the run may not change a target it doesn't own; the names are PBI-38519, Q-38519-002, schedule 7, agent selftest-probe. */
export function notOwnedMessage(target: LiveTestTarget): string {
  const labels: Record<Exclude<LiveTestTarget["kind"], "reference">, string> = { pbi: `PBI-${target.id}`, item: target.id, schedule: `schedule ${target.id}`, agent: `agent ${target.id}` };

  return target.kind === "reference"
    ? `${target.id} is no PBI link, #id or id: give the PBI's number (500, #500) or its link.`
    : `${labels[target.kind]} wasn't created by this test run; a live test changes only its own data.`;
}
