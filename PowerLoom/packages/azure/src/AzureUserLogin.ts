import { randomUUID } from "node:crypto";
import { PublicClientApplication, type AccountInfo, type AuthenticationResult, type ICachePlugin } from "@azure/msal-node";
import type { AzureLoginStart } from "./models/AzureLoginStart";
import type { AzureLoginStatus } from "./models/AzureLoginStatus";
import type { AzureToken } from "./models/AzureToken";
import type { AzureTokenCacheStore } from "./models/AzureTokenCacheStore";
import type { AzureUserAccount } from "./models/AzureUserAccount";
import { NotSignedInError } from "./models/NotSignedInError";

// The scope the sign-in asks for; the refresh token it yields serves every API the Azure MCP server asks a token for
// (user decision 2026-10-14: the user's own account, delegated to the server through the `az` shim).
const SIGN_IN_SCOPE = "https://management.azure.com/.default";
const AUTHORITY = "https://login.microsoftonline.com/organizations";

// Azure CLI's public client id: tenants consent to it already, and az itself signs in with it for the same APIs.
// AZURE_PUBLIC_CLIENT_ID overrides it when a tenant refuses it.
const AZURE_CLI_CLIENT_ID = "04b07795-8ddb-461a-bbee-02f9e1bf7b46";

// A finished flow stays readable this long, then it's forgotten.
const FINISHED_FLOW_TTL_MS = 10 * 60_000;

interface LoginFlow {
  vault: string;
  status: AzureLoginStatus["status"];
  username: string | null;
  error: string | null;
}

// Device-code sign-in with the user's own account, one MSAL client per vault; the token cache (the refresh token)
// lives in the store, so a sign-in survives a runner restart.
export class AzureUserLogin {
  private readonly apps = new Map<string, PublicClientApplication>();
  private readonly flows = new Map<string, LoginFlow>();

  constructor(
    private readonly store: AzureTokenCacheStore,
    private readonly clientId: string = process.env.AZURE_PUBLIC_CLIENT_ID?.trim() || AZURE_CLI_CLIENT_ID,
  ) {}

  // Resolves as soon as Entra hands out the code the user types; the sign-in itself completes in the background.
  start(vault: string): Promise<AzureLoginStart> {
    const flowId = randomUUID();
    const flow: LoginFlow = { vault, status: "pending", username: null, error: null };

    this.flows.set(flowId, flow);

    return new Promise<AzureLoginStart>((resolve, reject) => {
      this.appOf(vault)
        .acquireTokenByDeviceCode({
          scopes: [SIGN_IN_SCOPE],
          deviceCodeCallback: (code) => resolve({ flowId, userCode: code.userCode, verificationUri: code.verificationUri, message: code.message, expiresInSeconds: code.expiresIn }),
        })
        .then((result) => this.finish(flowId, flow, result))
        .catch((error: Error) => {
          this.fail(flowId, flow, error);
          reject(error);
        });
    });
  }

  status(flowId: string): AzureLoginStatus {
    const flow = this.flows.get(flowId);

    if (!flow) {
      return { status: "failed", username: null, error: "Unknown or expired sign-in; start again." };
    }

    return { status: flow.status, username: flow.username, error: flow.error };
  }

  async signedInAs(vault: string): Promise<AzureUserAccount | null> {
    const account = await this.accountOf(vault);

    return account ? accountSummary(account) : null;
  }

  async signOut(vault: string): Promise<void> {
    const cache = this.appOf(vault).getTokenCache();

    for (const account of await cache.getAllAccounts()) {
      await cache.removeAccount(account);
    }

    await this.store.clear(vault);
    await this.store.saveAccount(vault, null);
  }

  // What the `az` shim prints for the Azure MCP server: a silent token for the API it asks for, from the cached
  // refresh token, or a clear error when nobody signed in.
  async token(vault: string, resource: string, tenant: string | null): Promise<AzureToken> {
    const account = await this.accountOf(vault);

    if (!account) {
      throw new NotSignedInError(vault);
    }

    const authority = tenant ? `https://login.microsoftonline.com/${tenant}` : undefined;
    const scope = `${resource.replace(/\/+$/, "")}/.default`;
    const result = await this.appOf(vault).acquireTokenSilent({ account, scopes: [scope], authority });

    return tokenOf(result);
  }

  private async finish(flowId: string, flow: LoginFlow, result: AuthenticationResult | null): Promise<void> {
    const account = result?.account ? accountSummary(result.account) : null;

    flow.status = account ? "done" : "failed";
    flow.username = account?.username ?? null;
    flow.error = account ? null : "Entra answered without an account.";

    await this.store.saveAccount(flow.vault, account);
    this.forgetLater(flowId);
  }

  private fail(flowId: string, flow: LoginFlow, error: Error): void {
    flow.status = "failed";
    flow.error = error.message;
    this.forgetLater(flowId);
  }

  private forgetLater(flowId: string): void {
    setTimeout(() => this.flows.delete(flowId), FINISHED_FLOW_TTL_MS).unref();
  }

  private async accountOf(vault: string): Promise<AccountInfo | null> {
    const accounts = await this.appOf(vault).getTokenCache().getAllAccounts();

    return accounts[0] ?? null;
  }

  private appOf(vault: string): PublicClientApplication {
    const existing = this.apps.get(vault);

    if (existing) {
      return existing;
    }

    const app = new PublicClientApplication({ auth: { clientId: this.clientId, authority: AUTHORITY }, cache: { cachePlugin: cachePluginOf(this.store, vault) } });

    this.apps.set(vault, app);

    return app;
  }
}

// MSAL reads the whole cache before each access and hands it back after; the store keeps it per vault.
function cachePluginOf(store: AzureTokenCacheStore, vault: string): ICachePlugin {
  return {
    beforeCacheAccess: async (context) => {
      const cached = await store.read(vault);

      if (cached) {
        context.tokenCache.deserialize(cached);
      }
    },
    afterCacheAccess: async (context) => {
      if (context.cacheHasChanged) {
        await store.write(vault, context.tokenCache.serialize());
      }
    },
  };
}

function accountSummary(account: AccountInfo): AzureUserAccount {
  return { username: account.username, tenantId: account.tenantId, signedInAt: new Date().toISOString() };
}

// As `az account get-access-token` prints it; a missing expiry counts as five minutes from now.
function tokenOf(result: AuthenticationResult): AzureToken {
  const expiresOn = result.expiresOn ?? new Date(Date.now() + 5 * 60_000);

  return { accessToken: result.accessToken, expiresOn: azTimestamp(expiresOn), expires_on: Math.floor(expiresOn.getTime() / 1000), tenant: result.tenantId, tokenType: "Bearer" };
}

function azTimestamp(date: Date): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}000`;
}
