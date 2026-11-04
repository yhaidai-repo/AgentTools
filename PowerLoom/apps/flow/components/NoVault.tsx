// No vault is configured: the web app's Settings add one (Flow has no vault management of its own).
export function NoVault({ title }: { title: string }) {
  return (
    <>
      <h1>{title}</h1>
      <div className="card empty">No vault is configured. Add one in the web app (Vault page), then come back.</div>
    </>
  );
}
