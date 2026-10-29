"use client";

import type { useOpenChat } from "./useOpenChat";

// When the prompt couldn't be copied for the chat, it is shown to copy by hand.
export function ClipboardFallback({ launch }: { launch: ReturnType<typeof useOpenChat> }) {
  const done = () => launch.reset();

  return (
    <div className="clipboard-fallback">
      <label className="field">Prompt to paste<textarea readOnly rows={7} value={launch.manual?.clipboardText ?? ""} onFocus={(event) => event.currentTarget.select()} /></label>
      <div className="actions">
        <button type="button" disabled={launch.isPending} onClick={() => void launch.retryCopy(done)}>Retry copy and open</button>
        <button type="button" className="secondary" disabled={launch.isPending} onClick={() => launch.openAfterManualCopy(done)}>I copied it — open chat</button>
      </div>
    </div>
  );
}
