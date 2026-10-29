"use client";

import type { BuildCommands } from "@powerloom/db";
import { useActionState } from "react";
import { KeptForm } from "@/components/KeptForm";
import { ResultLine } from "@/components/ResultLine";
import type { ActionResult } from "@/models/ActionResult";
import { saveRepoCommandsAction } from "./actions";

// A repo's build and test commands for the vault's coding runs (the implementation agent's GSD runs them in the sandbox).
// Folded under the row until wanted; the summary shows what is saved. Each is one command or `cd <folder> && <command>`.
export function RepoCommandsForm({ repo, commands }: { repo: string; commands: BuildCommands }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveRepoCommandsAction, null);

  return (
    <details className="resource-commands">
      <summary title="Build and test commands for coding runs">{summaryOf(commands)}</summary>
      <KeptForm action={action}>
        <input type="hidden" name="repo" value={repo} />
        <div className="field-grid">
          <label className="field"><span>Build</span><input name="build" defaultValue={commands.build ?? ""} placeholder="dotnet build MySolution.sln" aria-label={`${repo} build command`} /></label>
          <label className="field"><span>Test</span><input name="test" defaultValue={commands.test ?? ""} placeholder="dotnet test MySolution.sln --no-build" aria-label={`${repo} test command`} /></label>
        </div>
        <div className="actions">
          <button type="submit" className="secondary small" disabled={isSaving}>{isSaving ? "Saving…" : "Save commands"}</button>
          <ResultLine result={result} />
        </div>
      </KeptForm>
    </details>
  );
}

function summaryOf(commands: BuildCommands): string {
  const parts = [commands.build && `build: ${commands.build}`, commands.test && `test: ${commands.test}`].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "No build or test commands: runs use the usual dotnet and npm ones";
}
