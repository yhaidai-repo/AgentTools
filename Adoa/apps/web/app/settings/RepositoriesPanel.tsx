import type { RepoRow } from "@adoa/core";
import { AddLocalRepoForm } from "./AddLocalRepoForm";
import { RepoRowForm } from "./RepoRowForm";

// Repository configuration (user decision 2026-10-06): the vault's ADO integration fills it with the synced repos, local
// checkouts are added by hand; the enabled ones are what agents clone and the PBI page offers.
export function RepositoriesPanel({ repos, reposRoot, adoActive }: { repos: RepoRow[]; reposRoot: string | null; adoActive: boolean }) {
  return (
    <div className="card">
      {repos.length === 0 ? (
        <p className="muted">{adoActive ? "No repositories yet: the next PBI sync lists the ADO repositories." : "No repositories yet: add local ones below, or enable the Azure DevOps integration."}</p>
      ) : (
        <RepoTable repos={repos} />
      )}
      <AddLocalRepoForm reposRoot={reposRoot} />
    </div>
  );
}

function RepoTable({ repos }: { repos: RepoRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Enabled</th><th>Repository</th><th>Source</th><th>Default branch</th><th></th></tr>
        </thead>
        <tbody>
          {repos.map((row) => <RepoRowForm key={row.id} repo={row} />)}
        </tbody>
      </table>
    </div>
  );
}
