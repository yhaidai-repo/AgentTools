"use client";

export function EditorConflictNotice({ conflict, loadLatest }: { conflict: boolean; loadLatest: () => void }) {
  return conflict ? <div role="status" className="result-error">A newer version is available. Your edits are kept; saving still checks the version you started from. <button type="button" onClick={loadLatest}>Load latest</button></div> : null;
}
