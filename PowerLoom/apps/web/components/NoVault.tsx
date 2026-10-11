import { OpenVaultsButton } from "./OpenVaultsButton";

// What every page shows while PowerLoom has no vault (user decision 2026-10-06).
export function NoVault({ title }: { title: string }) {
  return (
    <>
      <h1>{title}</h1>
      <div className="card placeholder">
        <p>No vault yet. A vault is a folder inside the vaults root with its docs, drafts and registers; PowerLoom pulls its PBIs, runs its agents and keeps its notes per vault.</p>
        <OpenVaultsButton />
      </div>
    </>
  );
}
