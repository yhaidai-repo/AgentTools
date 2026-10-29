/** `pending`'s value; meanwhile `tick` runs every `everyMs`, never two at once, and a tick that fails is skipped. */
export async function whilePending<T>(pending: Promise<T>, everyMs: number, tick: () => Promise<void>): Promise<T> {
  let isTicking = false;
  const timer = setInterval(() => {
    if (isTicking) {
      return;
    }

    isTicking = true;
    void tick().catch(() => undefined).finally(() => { isTicking = false; });
  }, everyMs);

  try {
    return await pending;
  } finally {
    clearInterval(timer);
  }
}
