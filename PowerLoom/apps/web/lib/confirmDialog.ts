import type { ConfirmOptions } from "@/models/ConfirmOptions";
import type { DialogRequest } from "@/models/DialogRequest";

type Listener = (request: DialogRequest) => void;

let listener: Listener | null = null;

// The mounted ConfirmHost registers itself here; without one (a page rendered without it) the browser's own boxes answer.
export function listenForDialogs(next: Listener | null): void {
  listener = next;
}

// PowerLoom's own confirm window instead of the browser's: resolves true when the person confirms.
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return ask({ options, isNotice: false });
}

// A refusal or result to read, closed with OK.
export async function noticeDialog(message: string): Promise<void> {
  await ask({ options: { message, confirmLabel: "OK" }, isNotice: true });
}

function ask(request: Omit<DialogRequest, "resolve">): Promise<boolean> {
  return new Promise((resolve) => {
    if (listener) {
      listener({ ...request, resolve });

      return;
    }

    resolve(fallback(request));
  });
}

function fallback({ options, isNotice }: Omit<DialogRequest, "resolve">): boolean {
  if (isNotice) {
    window.alert(options.message);

    return true;
  }

  return window.confirm(options.message);
}
