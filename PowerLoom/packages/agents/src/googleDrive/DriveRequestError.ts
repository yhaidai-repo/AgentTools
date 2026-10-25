// Google Drive refused a call; 401 and 403 are a refused sign-in or no access to the file.
export class DriveRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }

  get isDenied(): boolean {
    return this.status === 401 || this.status === 403;
  }
}
