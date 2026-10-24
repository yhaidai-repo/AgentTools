import createClient from "openapi-fetch";
import type { paths } from "./schema";

export type PowerLoomClient = ReturnType<typeof createClient<paths>>;

// PowerLoom's API (the .NET backend), typed from PowerLoom/openapi/PowerLoom.Api.json (`npm run openapi -w
// @powerloom/client` after an API change). The web, the CLI and the MCP server share this one client.
export function createPowerLoomClient(baseUrl: string | undefined): PowerLoomClient {
  return createClient<paths>({ baseUrl: baseUrl?.replace(/\/+$/, "") ?? "http://powerloom-url-not-set" });
}
