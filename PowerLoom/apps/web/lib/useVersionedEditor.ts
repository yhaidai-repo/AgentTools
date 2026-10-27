"use client";

import { useState } from "react";

interface Draft {
  identity: string;
  text: string;
  baseline: string;
  baseText: string;
  observedText: string;
  observedBaseline: string;
}

// A comparison baseline belongs to the content the user saw, not to the latest server render.
export function useVersionedEditor(identity: string, serverText: string, serverBaseline: string) {
  const fresh = (): Draft => ({ identity, text: serverText, baseline: serverBaseline, baseText: serverText, observedText: serverText, observedBaseline: serverBaseline });
  const [stored, setDraft] = useState<Draft>(fresh);
  let draft = stored;
  if (stored.identity !== identity || stored.observedText !== serverText || stored.observedBaseline !== serverBaseline) {
    const canAdopt = stored.identity !== identity || stored.text === stored.baseText || stored.text === serverText;
    draft = canAdopt ? fresh() : { ...stored, observedText: serverText, observedBaseline: serverBaseline };
    // Adjust before React commits this render: a hidden baseline and its visible text always move together.
    setDraft(draft);
  }
  return {
    text: draft.text,
    baseline: draft.baseline,
    conflict: draft.baseline !== serverBaseline || draft.baseText !== serverText,
    edit: (text: string) => setDraft(current => ({ ...current, text })),
    loadLatest: () => setDraft(fresh()),
  };
}
