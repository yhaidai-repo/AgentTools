export interface SandboxRequestOptions {
  body?: BodyInit;
  contentType?: string;
  timeoutMs: number;
  headers?: Record<string, string>;
}
