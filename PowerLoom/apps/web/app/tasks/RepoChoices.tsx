// The vault's enabled repositories an agent may read, for a task or schedule without a PBI.
export function RepoChoices({ repos, checked }: { repos: string[]; checked: string[] }) {
  return (
    <fieldset className="repo-choices">
      <legend>Repositories the agent may read (the vault&apos;s enabled ones)</legend>
      {repos.length === 0 && <span className="muted">None enabled: configure them in Settings → Repositories.</span>}
      {repos.map((name) => (
        <label key={name} className="inline">
          <input type="checkbox" name="repos" value={name} defaultChecked={checked.includes(name)} />
          {name}
        </label>
      ))}
    </fieldset>
  );
}
