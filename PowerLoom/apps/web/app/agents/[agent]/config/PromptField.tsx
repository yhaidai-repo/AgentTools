"use client";

import { useState } from "react";
import { LocalTime } from "@/components/LocalTime";
import type { PromptFile } from "@/models/PromptFile";

export interface PromptVersion {
  version: number;
  text: string;
  createdAt: Date;
}

interface PromptFieldProps {
  /** The stored prompt; empty when the agent runs on its prompt file. */
  stored: string;
  storedVersion: number;
  file: PromptFile | null;
  versions: PromptVersion[];
}

// The agent's instructions, always visible and editable (user decision 2026-10-23): the stored prompt when there is one,
// else the prompt file shipped with the code. Saving an edit makes a new version; the earlier ones can be restored, and
// saving the file's text again puts the agent back on the file.
export function PromptField({ stored, storedVersion, file, versions }: PromptFieldProps) {
  const current = stored || file?.text || "";
  const [text, setText] = useState(current);
  const source = stored ? `stored v${storedVersion}` : file ? `file ${file.version}` : "none";

  return (
    <section className="config-section">
      <h2>Prompt <small className="muted">{source}</small></h2>
      <label className="field">
        <span>Instructions</span>
        <textarea name="prompt" rows={18} value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} />
      </label>
      <p className="field-hint">
        Saving a change makes version {storedVersion + 1}. <code>{"{{framework}}"}</code> inserts the shared framework; <code>{"{{team}}"}</code> and <code>{"{{agent}}"}</code> are filled per run.
        {file && stored && <> <button type="button" className="link" onClick={() => setText(file.text)}>Use the file ({file.version}) again</button></>}
      </p>
      {versions.length > 0 && (
        <details className="prompt-versions">
          <summary>Earlier versions ({versions.length})</summary>
          <ul>
            {versions.map((version) => (
              <li key={version.version}>
                <details>
                  <summary>v{version.version} · <LocalTime date={version.createdAt} />{version.version === storedVersion && stored ? " · current" : ""}</summary>
                  <pre>{version.text}</pre>
                  <button type="button" className="secondary small" onClick={() => setText(version.text)}>Put into the editor</button>
                </details>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
