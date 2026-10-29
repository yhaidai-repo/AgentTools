import { buildCommandsOf, type RepoCommandSettings, type RepoRow } from "@powerloom/core";
import Link from "next/link";
import { AddLocalRepoForm } from "./AddLocalRepoForm";
import { RepoRowForm } from "./RepoRowForm";

const SHOWS = [
  { key: "all", label: "All" },
  { key: "on", label: "On" },
  { key: "off", label: "Off" },
] as const;

// Repository configuration (user decision 2026-10-06): the vault's ADO integration and GitHub (user decision 2026-10-25)
// fill it with their repos, local checkouts are added by hand; the enabled ones are what agents clone and the PBI page
// offers. One row each with its switch and its build and test commands, and All / On / Off pills (user decision 2026-10-18).
export function RepositoriesPanel({ repos, commands, reposRoot, adoActive, show }: { repos: RepoRow[]; commands: RepoCommandSettings; reposRoot: string | null; adoActive: boolean; show: string }) {
  const shown = repos.filter((row) => show === "all" || (show === "on") === !row.excluded);

  return (
    <>
      <div className="add-on-top"><AddLocalRepoForm reposRoot={reposRoot} /></div>
      <div className="tab-bar">
        <nav className="status-pills" aria-label="Filter repositories">
          {SHOWS.map((choice) => <Link key={choice.key} href={`/settings?tab=repos&show=${choice.key}`} className={choice.key === show ? "status-pill on" : "status-pill"}>{choice.label} <b>{countOf(repos, choice.key)}</b></Link>)}
        </nav>
        <span className="tab-filters hint">What agents clone and the PBI page offers</span>
      </div>
      <div className="panel">
        {repos.length === 0 && <p className="panel-body hint">{adoActive ? "No repositories yet: the next PBI sync lists the ADO repositories." : "No repositories yet: add local ones above, or connect GitHub or Azure DevOps in their tabs."}</p>}
        {shown.map((row) => <RepoRowForm key={row.id} repo={row} commands={buildCommandsOf(commands, row.name)} />)}
      </div>
    </>
  );
}

function countOf(repos: RepoRow[], show: string): number {
  return repos.filter((row) => show === "all" || (show === "on") === !row.excluded).length;
}
