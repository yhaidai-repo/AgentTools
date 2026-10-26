// GitHub refused a call. 401 and a 403 that isn't the rate limit are a refused token: the user fixes it.
export class GitHubApiError extends Error {
  constructor(readonly status: number, message: string, private readonly rateLimited = false) {
    super(message);
  }

  get isDenied(): boolean {
    return this.status === 401 || (this.status === 403 && !this.rateLimited);
  }
}
