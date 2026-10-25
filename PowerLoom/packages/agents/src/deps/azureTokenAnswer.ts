import { createHash, timingSafeEqual } from "node:crypto";
import { NotSignedInError, type AzureUserLogin } from "@powerloom/azure";

export interface HttpAnswer {
  status: number;
  body: object;
}

// The `az` shim's question for the Azure MCP server (`GET /azure/token?vault=&resource=&tenant=`): a token of the
// vault's sign-in for one API. 401 when nobody signed in, so the shim answers as a signed-out az would and the tool
// call becomes `denied`. Served by every host that starts the server: the agent-runner and the MCP server.
// Only the shim may ask (SEC-001, 2026-10-25): it sends the host's secret (DepsEnv.azureTokenSecret) as a bearer token,
// which no other local client or container has; without it the answer is 403 and no token.
export async function azureTokenAnswer(login: AzureUserLogin, url: URL, authorization: string | undefined, secret: string): Promise<HttpAnswer> {
  if (!isShim(authorization, secret)) {
    return { status: 403, body: { error: "only the Azure MCP server's az shim may ask for tokens" } };
  }

  const vault = url.searchParams.get("vault");
  const resource = url.searchParams.get("resource");

  if (!vault || !resource) {
    return { status: 400, body: { error: "expected ?vault=&resource=" } };
  }

  try {
    return { status: 200, body: await login.token(vault, resource, url.searchParams.get("tenant") || null) };
  } catch (error) {
    return { status: error instanceof NotSignedInError ? 401 : 502, body: { error: (error as Error).message } };
  }
}

// Compared as hashes, so the time taken says nothing about the secret, its length included.
function isShim(authorization: string | undefined, secret: string): boolean {
  if (!secret || !authorization) {
    return false;
  }

  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}

function digest(text: string): Buffer {
  return createHash("sha256").update(text).digest();
}
