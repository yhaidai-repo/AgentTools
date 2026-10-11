"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FinishDialog } from "@/components/FinishDialog";

// Opens the Finish dialog for this PBI; the page reloads after it.
export function FinishPbiButton({ adoId, title }: { adoId: number; title: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  function onDone() {
    setIsOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="secondary" onClick={() => setIsOpen(true)}>Finish</button>
      {isOpen && <FinishDialog pbis={[{ adoId, title }]} onDone={onDone} />}
    </>
  );
}
