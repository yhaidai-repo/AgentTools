export class AdoRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "AdoRequestError";
  }
}
