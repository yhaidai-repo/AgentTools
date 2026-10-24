// The answer of a host-side HTTP request: status, a few headers and the body (secrets redacted, cut when long).
export interface SecretHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  bodyCut: boolean;
}
