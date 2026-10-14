// Azure Resource Manager answered with an error status; 401 and 403 mean the sign-in may not read the resource.
export class ArmError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`Azure Resource Manager answered ${status}: ${body.slice(0, 300)}`);
    this.name = "ArmError";
  }
}
