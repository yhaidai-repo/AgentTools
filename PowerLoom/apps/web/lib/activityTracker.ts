// Knows when the page is waiting for the server: counts the server actions in flight (a form or a button that calls one)
// and marks the button the user pressed as busy until they are all answered. Installed once, by ActivityBar.
const PRESS_WINDOW_MS = 1500;

const listeners = new Set<() => void>();
const busyButtons = new Set<HTMLButtonElement>();
let inFlight = 0;
let lastPress: { button: HTMLButtonElement; at: number } | null = null;
let isInstalled = false;

export function actionsInFlight(): number {
  return inFlight;
}

export function subscribeToActions(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function installActivityTracking(): void {
  if (isInstalled) {
    return;
  }

  isInstalled = true;
  document.addEventListener("click", rememberClick, true);
  document.addEventListener("submit", rememberSubmitter, true);
  trackServerActions();
}

function rememberClick(event: MouseEvent): void {
  const button = event.target instanceof Element ? event.target.closest("button") : null;

  rememberPress(button);
}

function rememberSubmitter(event: SubmitEvent): void {
  rememberPress(event.submitter instanceof HTMLButtonElement ? event.submitter : null);
}

function rememberPress(button: HTMLButtonElement | null): void {
  if (button) {
    lastPress = { button, at: Date.now() };
  }
}

function trackServerActions(): void {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    if (!isServerAction(input, init)) {
      return nativeFetch(input, init);
    }

    actionStarted();

    try {
      return await nativeFetch(input, init);
    } finally {
      actionFinished();
    }
  };
}

function isServerAction(input: RequestInfo | URL, init?: RequestInit): boolean {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));

  return headers.has("next-action");
}

function actionStarted(): void {
  inFlight += 1;
  markPressedButtonBusy();
  notify();
}

function actionFinished(): void {
  inFlight -= 1;

  if (inFlight === 0) {
    clearBusyButtons();
  }

  notify();
}

function markPressedButtonBusy(): void {
  const isRecent = lastPress !== null && Date.now() - lastPress.at < PRESS_WINDOW_MS;

  if (!isRecent || !lastPress) {
    return;
  }

  lastPress.button.dataset.busy = "true";
  busyButtons.add(lastPress.button);
}

function clearBusyButtons(): void {
  busyButtons.forEach((button) => delete button.dataset.busy);
  busyButtons.clear();
}

function notify(): void {
  listeners.forEach((listener) => listener());
}
