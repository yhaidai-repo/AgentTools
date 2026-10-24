// A failed Confluence call; the message is meant for the user (it ends up in their task when a page can't be fetched).
export class ConfluenceRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ConfluenceRequestError";
  }
}
