import { NotSignedInError, type AzureUserLogin } from "@powerloom/azure";

export interface HttpAnswer {
  status: number;
  body: object;
}

// The `az` shim's question for the Azure MCP server (`GET /azure/token?vault=&resource=&tenant=`): a token of the
// vault's sign-in for one API. 401 when nobody signed in, so the shim answers as a signed-out az would and the tool
// call becomes `denied`. Served by every host that starts the server: the agent-runner and the MCP server.
export async function azureTokenAnswer(login: AzureUserLogin, url: URL): Promise<HttpAnswer> {
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
