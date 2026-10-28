// SearXNG answered with an error status, or couldn't be reached (status 0).
export class WebSearchRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
