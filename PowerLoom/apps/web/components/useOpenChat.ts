"use client";

import type { ChatDestination, ChatTarget } from "@powerloom/core";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { openChatAction } from "@/app/chat/actions";
import { launchDesktopChat } from "@/lib/launchDesktopChat";
import type { ContinueResult } from "@/models/ContinueResult";

// Opens a chat on a target: the command prepares what the chat reads, then the browser follows the link into the agent
// app; a refusal stays as the message.
export function useOpenChat() {
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manual, setManual] = useState<ContinueResult | null>(null);
  const [isPending, setPending] = useState(false);
  const busy = useRef(false);

  async function deliver(result: ContinueResult, onOpened?: () => void) {
    const launched = await launchDesktopChat(result, {
      copy: (text) => navigator.clipboard.writeText(text),
      notify: (text) => flushSync(() => { setNotice(text); setMessage(null); setManual(null); onOpened?.(); }),
      navigate: (url) => { window.location.href = url; },
    });
    setMessage(launched.error);
    setManual(launched.manual);
  }

  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage(null);
    setNotice(null);
    try { await action(); }
    catch { setMessage("The chat couldn't be opened. Please retry."); }
    finally { busy.current = false; setPending(false); }
  }

  async function open(target: ChatTarget, destination?: ChatDestination, onOpened?: () => void) {
    await run(async () => {
      setManual(null);
      await deliver(await openChatAction(target, destination), onOpened);
    });
  }

  async function retryCopy(onOpened: () => void) {
    if (manual) await run(() => deliver(manual, onOpened));
  }

  function openAfterManualCopy(onOpened: () => void) {
    if (!manual?.link) return;
    const link = manual.link;
    flushSync(() => { setManual(null); setMessage(null); setNotice("Opening the chat…"); onOpened(); });
    window.location.href = link;
  }

  function reset(clearNotice = true) { setManual(null); setMessage(null); if (clearNotice) setNotice(null); }

  return { open, isPending, message, notice, manual, retryCopy, openAfterManualCopy, reset };
}
