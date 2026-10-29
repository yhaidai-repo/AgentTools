"use client";

import type { RepoRow } from "@powerloom/core";
import { useTransition } from "react";
import { removeLocalRepoAction, setRepoEnabledAction } from "./actions";

// Where a repo comes from; `adoProject` holds a GitHub repo's owner.
const TAGS: Record<RepoRow["kind"], { className: string; text: (project: string) => string }> = {
  ado: { className: "source-tag ado", text: (project) => `ADO · ${project}` },
  github: { className: "source-tag ado", text: (owner) => `GitHub · ${owner}` },
  local: { className: "source-tag", text: () => "local" },
};

// One catalog repo: its switch saves at once; a local repo can be removed (an ADO or GitHub one comes back with the
// next sync).
export function RepoRowForm({ repo }: { repo: RepoRow }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className={`resource-row${repo.excluded ? " off" : ""}`}>
      <label className="row-switch" title={repo.excluded ? "Off" : "On"}>
        <input type="checkbox" checked={!repo.excluded} disabled={isPending} onChange={(event) => startTransition(() => setRepoEnabledAction(repo.id, event.target.checked))} aria-label={`${repo.name} enabled`} />
        <span className="switch-knob" aria-hidden="true" />
      </label>
      <span className="resource-name-text">{repo.name}</span>
      <SourceTag repo={repo} />
      <span className="resource-target">{repo.defaultBranch?.replace(/^refs\/heads\//, "") ?? "–"}</span>
      <span className="resource-actions">{repo.kind === "local" && <button type="button" className="danger small" disabled={isPending} onClick={() => startTransition(() => removeLocalRepoAction(repo.id))}>Remove</button>}</span>
    </div>
  );
}

// An ADO or GitHub repo's tag opens the repo in its own site; a local one has nowhere to go.
function SourceTag({ repo }: { repo: RepoRow }) {
  const tag = TAGS[repo.kind];
  const text = tag.text(repo.adoProject);

  if (repo.kind === "local") {
    return <span className={tag.className}>{text}</span>;
  }

  return <a className={tag.className} href={browserUrl(repo.remoteUrl)} target="_blank" rel="noreferrer" title="Open the repository">{text}</a>;
}

// A clone URL can carry a user name (https://org@dev.azure.com/…) and GitHub's ends in .git; neither belongs in a link.
function browserUrl(remoteUrl: string): string {
  return remoteUrl.replace(/\/\/[^@/]+@/, "//").replace(/\.git$/, "");
}
