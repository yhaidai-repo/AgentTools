// One restore at a time per packages volume: NuGet's and npm's locks live in each restore container's own /tmp, so two
// restores of the same vault's cache side by side could extract the same package at once.
export class RestoreQueue {
  private readonly tails = new Map<string, Promise<unknown>>();

  run<T>(volume: string, restore: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(volume) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(restore);

    this.tails.set(volume, next);
    void next.finally(() => this.forgetIfLast(volume, next)).catch(() => undefined);

    return next;
  }

  private forgetIfLast(volume: string, tail: Promise<unknown>): void {
    if (this.tails.get(volume) === tail) {
      this.tails.delete(volume);
    }
  }
}
