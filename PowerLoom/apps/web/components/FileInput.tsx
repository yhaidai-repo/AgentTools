"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";

// Several files at once, from the picker, the clipboard (Ctrl+V anywhere in the form: a screenshot, or files copied in
// the file explorer) or dropped on the box (user decision 2026-10-09). Everything lands in one file input, so the form
// posts the files like any picked ones.
export function FileInput({ name, accept, required }: { name: string; accept: string; required?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);

  function addFiles(files: File[]) {
    const target = input.current;

    if (!target || files.length === 0) {
      return;
    }

    const transfer = new DataTransfer();

    for (const file of [...(target.files ?? []), ...files.map(withUniqueName)]) {
      transfer.items.add(file);
    }

    target.files = transfer.files;
    setNames(fileNames(target));
  }

  function clear() {
    if (input.current) {
      input.current.value = "";
    }

    setNames([]);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles([...event.dataTransfer.files]);
  }

  useEffect(() => {
    const form = input.current?.form;

    if (!form) {
      return;
    }

    // Only a paste that carries files is taken; pasting text into a field works as usual.
    const onPaste = (event: ClipboardEvent) => {
      const files = [...(event.clipboardData?.files ?? [])];

      if (files.length > 0) {
        event.preventDefault();
        addFiles(files);
      }
    };

    form.addEventListener("paste", onPaste);

    return () => form.removeEventListener("paste", onPaste);
  }, []);

  return (
    <div className="file-input" tabIndex={0} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
      <input ref={input} type="file" name={name} accept={accept} required={required} multiple onChange={(event) => setNames(fileNames(event.currentTarget))} />
      <span className="muted">or paste (Ctrl+V) / drop files here</span>
      {names.length > 0 && (
        <span>
          {names.join(", ")} <button type="button" className="link-button" onClick={clear}>clear</button>
        </span>
      )}
    </div>
  );
}

function fileNames(input: HTMLInputElement): string[] {
  return [...(input.files ?? [])].map((file) => file.name);
}

// A pasted screenshot is always "image.png"; a time stamp keeps several pastes apart.
function withUniqueName(file: File): File {
  if (file.name !== "image.png") {
    return file;
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

  return new File([file], `pasted-${stamp}-${Math.random().toString(36).slice(2, 6)}.png`, { type: file.type });
}
