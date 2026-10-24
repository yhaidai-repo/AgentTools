import Link from "next/link";

// The vault's enabled repositories an agent may read, for a task or schedule without a PBI: toggle chips that light up
// when chosen (user decision 2026-10-18); each is a checkbox, so the form posts them as before.
export function RepoChoices({ repos, checked }: { repos: string[]; checked: string[] }) {
  return (
    <div className="panel new-pbi-side">
      <span className="field-label">Repositories <small>the agent may read</small></span>
      {repos.length === 0 && <p className="hint">None enabled: turn them on in <Link href="/settings">Settings → Repositories</Link>.</p>}
      <div className="repo-chips">
        {repos.map((name) => (
          <label key={name} className="repo-check">
            <input type="checkbox" name="repos" value={name} defaultChecked={checked.includes(name)} />
            <span>{name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
