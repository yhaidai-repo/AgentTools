// Only PBIs nobody has started yet enter adoa by themselves (user decision 2026-10-02), whatever the sync settings say:
// full sync and imports refuse the others; the Backlog's "Sync PBI" is free of it. A PBI already in adoa stays and keeps
// being refreshed in any state.
const ENTRY_ADO_STATES = ["New", "Ready for Dev"];

export function canEnterAdoa(adoState: string): boolean {
  return ENTRY_ADO_STATES.includes(adoState);
}

export function entryRefusal(adoId: number, adoState: string): string {
  return `PBI-${adoId} is ${adoState} in Azure DevOps; only ${ENTRY_ADO_STATES.join(" or ")} PBIs enter adoa`;
}
