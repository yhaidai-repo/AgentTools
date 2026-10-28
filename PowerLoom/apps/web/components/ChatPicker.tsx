"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatDestination, ChatTarget } from "@powerloom/core";
import type { components } from "@powerloom/client";
import { chatConversationsAction } from "@/app/chat/actions";
import type { useOpenChat } from "./useOpenChat";

export function ChatPicker({ target, label, launch, onClose }: { target: ChatTarget; label: string; launch: ReturnType<typeof useOpenChat>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [search, setSearch] = useState("");
  const [choices, setChoices] = useState<components["schemas"]["ChatConversationChoices"] | null>(null);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const targetKey = JSON.stringify(target);

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    if (mode !== "existing") return;
    let active = true;
    setLoading(true);
    setError(null);
    setSelected("");
    const timer = setTimeout(() => {
      chatConversationsAction(target, search).then((result) => {
        if (!active) return;
        setChoices(result.data ?? null);
        setError(result.error ?? null);
        setLoading(false);
      }).catch(() => {
        if (active) { setError("Couldn't load the chats. Please retry."); setLoading(false); }
      });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [mode, search, revision, targetKey]);

  function open() {
    if (mode === "new") { void launch.open(target, undefined, onClose); return; }
    if (!selected || !choices || loading) return;
    const destination: ChatDestination = { launcher: choices.launcher as ChatDestination["launcher"], conversationId: selected };
    void launch.open(target, destination, onClose);
  }

  return (
    <dialog ref={dialog} className="modal chat-picker" aria-labelledby="chat-picker-title" onCancel={(event) => { event.preventDefault(); if (!launch.isPending) onClose(); }}>
      <div className="chat-picker-body">
        <h2 id="chat-picker-title">Continue with {choices?.label ?? label}</h2>
        <fieldset className="chat-mode" disabled={launch.isPending}>
          <legend>Where to continue</legend>
          <label><input type="radio" name="chat-mode" checked={mode === "new"} onChange={() => { launch.reset(); setMode("new"); }} /> New chat</label>
          <label><input type="radio" name="chat-mode" checked={mode === "existing"} onChange={() => { launch.reset(); setMode("existing"); }} /> Existing chat</label>
        </fieldset>
        {mode === "existing" && <>
          <label className="field">Find a chat<input type="search" placeholder="Search by title or folder" maxLength={200} value={search} disabled={launch.isPending} onChange={(event) => { launch.reset(); setSelected(""); setSearch(event.target.value); }} /></label>
          {loading && <p role="status">Loading chats…</p>}
          {error && <p role="alert" className="result-error">{error} <button type="button" className="secondary" onClick={() => { launch.reset(); setRevision(revision + 1); }}>Retry</button></p>}
          {!loading && !error && choices && <>
            <p className="muted">Recent chats, with this project first. Search to find older chats.</p>
            {choices.conversations.length === 0 && <p>No matching chats found.</p>}
            <div className="chat-options" role="group" aria-label="Available conversations">
              {choices.conversations.map((chat) => <label key={chat.id} className={`chat-option${selected === chat.id ? " selected" : ""}`}>
                <input type="radio" name="conversation" value={chat.id} checked={selected === chat.id} disabled={launch.isPending} onChange={() => { launch.reset(); setSelected(chat.id); }} />
                <span><strong>{chat.title}</strong>{chat.isRelated && <span className="chip">This project</span>}<small>{chat.folder || "No project folder"}</small><small>{new Date(chat.updatedAt).toLocaleString()}</small></span>
              </label>)}
            </div>
          </>}
        </>}
        {launch.message && <p className="result-error" role="alert">{launch.message}</p>}
        {launch.manual?.clipboardText && <div className="clipboard-fallback">
          <label className="field">Prompt to paste<textarea readOnly rows={7} value={launch.manual.clipboardText} onFocus={(event) => event.currentTarget.select()} /></label>
          <div className="actions"><button type="button" disabled={launch.isPending} onClick={() => void launch.retryCopy(onClose)}>Retry copy and open</button><button type="button" className="secondary" disabled={launch.isPending} onClick={() => launch.openAfterManualCopy(onClose)}>I copied it — open chat</button></div>
        </div>}
        <div className="actions">
          <button type="button" disabled={launch.isPending || mode === "existing" && (!selected || loading || error !== null)} onClick={open}>{launch.isPending ? "Opening…" : mode === "new" ? "New chat" : "Open selected chat"}</button>
          <button type="button" className="secondary" disabled={launch.isPending} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </dialog>
  );
}
