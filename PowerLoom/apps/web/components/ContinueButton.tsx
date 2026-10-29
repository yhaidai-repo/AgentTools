"use client";

import type { ChatTarget } from "@powerloom/core";
import { ChatMenu } from "./ChatMenu";
import { ClipboardFallback } from "./ClipboardFallback";
import { Dropdown } from "./Dropdown";
import { useOpenChat } from "./useOpenChat";

// "Continue with <agent>" (or "Configure with <agent>"): the button opens a new chat in the configured agent app; for
// a PBI or item the arrow beside it also offers an existing chat. Disabled with the reason while no chat can open.
export function ContinueButton({ target, label, problem, verb }: { target: ChatTarget; label: string; problem: string | null; verb: string }) {
  const launch = useOpenChat();
  const { open, isPending, message, notice, manual } = launch;
  const canPick = target.kind !== "vault" && target.kind !== "import" && problem === null;

  const main = <button type="button" onClick={() => { launch.reset(); void open(target); }} disabled={isPending || problem !== null} title={problem ?? undefined}>{isPending ? "Opening…" : `${verb} with ${label}`}</button>;

  return (
    <span className="actions">
      {canPick ? (
        <span className="split-button">
          {main}
          <Dropdown label="More ways to continue" align="right" trigger={null}>
            {(close) => <ChatMenu target={target} launch={launch} close={close} />}
          </Dropdown>
        </span>
      ) : main}
      {problem && <span className="muted">{problem}</span>}
      {message && <span className="result-error" role="alert">{message}</span>}
      {notice && <span role="status">{notice}</span>}
      {manual?.clipboardText && <ClipboardFallback launch={launch} />}
    </span>
  );
}
