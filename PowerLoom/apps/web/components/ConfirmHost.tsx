"use client";

import { useEffect, useRef, useState } from "react";
import { listenForDialogs } from "@/lib/confirmDialog";
import type { DialogRequest } from "@/models/DialogRequest";

interface Waiting {
  id: number;
  request: DialogRequest;
}

// PowerLoom's own confirm window (user request 2026-10-29: not the browser's): mounted once in the layout, it shows
// the questions and notices that confirmDialog / noticeDialog ask for, one after the other.
export function ConfirmHost() {
  const [queue, setQueue] = useState<Waiting[]>([]);
  const lastId = useRef(0);

  useEffect(() => {
    listenForDialogs((request) => setQueue((waiting) => [...waiting, { id: ++lastId.current, request }]));

    return () => listenForDialogs(null);
  }, []);

  const current = queue[0];

  if (!current) {
    return null;
  }

  function answer(accepted: boolean): void {
    current.request.resolve(accepted);
    setQueue((waiting) => waiting.slice(1));
  }

  return <ConfirmWindow key={current.id} request={current.request} onAnswer={answer} />;
}

function ConfirmWindow({ request, onAnswer }: { request: DialogRequest; onAnswer: (accepted: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { options, isNotice } = request;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog ref={dialog} className="modal confirm-dialog" aria-labelledby="confirm-title" onCancel={(event) => { event.preventDefault(); onAnswer(false); }}>
      <h2 id="confirm-title">{options.title ?? (isNotice ? "PowerLoom" : "Are you sure?")}</h2>
      <p>{options.message}</p>
      <div className="actions">
        {!isNotice && <button type="button" className="secondary" autoFocus={options.isDanger} onClick={() => onAnswer(false)}>Cancel</button>}
        <button type="button" className={options.isDanger ? "danger" : undefined} autoFocus={!options.isDanger} onClick={() => onAnswer(true)}>{options.confirmLabel ?? "Confirm"}</button>
      </div>
    </dialog>
  );
}
