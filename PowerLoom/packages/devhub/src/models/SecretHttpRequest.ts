// POST /browser/http-request: DevHub sends it from the host with `{{secret:<name>}}` (or `{{secret:<name>|basic}}`)
// placeholders filled from dev-secrets.
export interface SecretHttpRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  contentType?: string;
}
