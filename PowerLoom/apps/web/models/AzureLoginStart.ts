// What the user needs to finish a device-code sign-in: the code to type at the link.
export interface AzureLoginStart {
  flowId: string;
  userCode: string;
  verificationUri: string;
  expiresInSeconds: number;
}
