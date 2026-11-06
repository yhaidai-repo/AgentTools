// The backend hasn't created the flow tables yet (lib/flowTables.ts): nothing to list, nothing to save.
export function FlowTablesMissing({ title }: { title: string }) {
  return (
    <>
      <h1>{title}</h1>
      <div className="card empty">
        PowerLoom&apos;s database has no flow tables yet (<code>flow</code>, <code>flow_execution</code>). Deploy a PowerLoom with the Flows feature; its startup
        migration creates them, and this page fills in.
      </div>
    </>
  );
}
