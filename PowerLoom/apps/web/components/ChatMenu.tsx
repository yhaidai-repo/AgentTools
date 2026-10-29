"use client";

import { useEffect, useState } from "react";
import type { ChatDestination, ChatTarget } from "@powerloom/core";
import type { components } from "@powerloom/client";
import { chatConversationsAction } from "@/app/chat/actions";
import type { useOpenChat } from "./useOpenChat";

type Launch = ReturnType<typeof useOpenChat>;
type Choices = components["schemas"]["ChatConversationChoices"];

const SEARCH_DELAY_MS = 250;

// The split button's menu: a new chat, or one of the existing chats listed right here; a click opens it.
export function ChatMenu({ target, launch, close }: { target: ChatTarget; launch: Launch; close: () => void }) {
  const [isListing, setIsListing] = useState(false);

  if (isListing) {
    return <ExistingChats target={target} launch={launch} close={close} onBack={() => setIsListing(false)} />;
  }

  return (
    <>
      <button type="button" className="menu-item" role="menuitem" onClick={() => { close(); void launch.open(target); }}><span className="menu-text">New chat</span></button>
      <button type="button" className="menu-item" role="menuitem" onClick={() => { launch.reset(); setIsListing(true); }}><span className="menu-text">Existing chat…</span></button>
    </>
  );
}

function ExistingChats({ target, launch, close, onBack }: { target: ChatTarget; launch: Launch; close: () => void; onBack: () => void }) {
  const [search, setSearch] = useState("");
  const [choices, setChoices] = useState<Choices | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const targetKey = JSON.stringify(target);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      chatConversationsAction(target, search).then((result) => {
        if (!isCurrent) return;
        setChoices(result.data ?? null);
        setError(result.error ?? null);
        setIsLoading(false);
      }).catch(() => {
        if (isCurrent) { setError("Couldn't load the chats. Please retry."); setIsLoading(false); }
      });
    }, SEARCH_DELAY_MS);

    return () => { isCurrent = false; clearTimeout(timer); };
  }, [search, revision, targetKey]);

  function openChat(loaded: Choices, conversationId: string) {
    const destination: ChatDestination = { launcher: loaded.launcher as ChatDestination["launcher"], conversationId };

    close();
    void launch.open(target, destination);
  }

  return (
    <div className="chat-menu">
      <button type="button" className="menu-item plain" onClick={onBack}><span className="menu-text">‹ Back</span></button>
      <input type="search" className="chat-search" placeholder="Search title or folder" aria-label="Find a chat" maxLength={200} autoFocus value={search} onChange={(event) => setSearch(event.target.value)} />
      {isLoading && <p className="muted chat-menu-note" role="status">Loading chats…</p>}
      {error && <p className="result-error chat-menu-note" role="alert">{error} <button type="button" className="secondary small" onClick={() => setRevision(revision + 1)}>Retry</button></p>}
      {!isLoading && !error && choices?.conversations.length === 0 && <p className="muted chat-menu-note">No matching chats.</p>}
      {!isLoading && !error && choices && (
        <div className="chat-options" role="group" aria-label="Available chats">
          {choices.conversations.map((chat) => (
            <button key={chat.id} type="button" className="menu-item chat-row" onClick={() => openChat(choices, chat.id)}>
              <span><strong>{chat.title}</strong>{chat.isRelated && <span className="chip">This project</span>}<small>{chat.folder || "No project folder"} · {new Date(chat.updatedAt).toLocaleDateString()}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
