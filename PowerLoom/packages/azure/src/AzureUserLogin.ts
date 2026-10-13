import { randomUUID } from "node:crypto";
import { PublicClientApplication, type AccountInfo, type AuthenticationResult, type ICachePlugin } from "@azure/msal-node";
import type { AzureLoginStart } from "./models/AzureLoginStart";
import type { AzureLoginStatus } from "./models/AzureLoginStatus";
import type { AzureTokenCacheStore } from "./models/AzureTokenCacheStore";
import type { AzureTokenCredential } from "./models/AzureTokenCredential";
import type { AzureUserAccount } from "./models/AzureUserAccount";
import { NotSignedInError } from "./models/NotSignedInError";

// The one scope this identity ever asks for (user decision 2026-10-13: the user's own account reads App Insights;
// no app registration exists): a token for the logs API can't touch anything else.
const LOGS_SCOPE = "https://api.loganalytics.io/.default";
const AUTHORITY = "https://login.microsoftonline.com/organizations";

// Azure CLI's public client id: tenants consent to it already, and `az monitor log-analytics query` signs in with it
// for the same API. AZURE_PUBLIC_CLIENT_ID overrides it when a tenant refuses it.
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
          scopes: [LOGS_SCOPE],
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

  // What LogsQueryClient takes: a silent token from the cached refresh token, or a clear error when nobody signed in.
  logsCredential(vault: string): AzureTokenCredential {
    return {
      getToken: async () => {
        const account = await this.accountOf(vault);

        if (!account) {
          throw new NotSignedInError(vault);
        }

        const result = await this.appOf(vault).acquireTokenSilent({ account, scopes: [LOGS_SCOPE] });

        return { token: result.accessToken, expiresOnTimestamp: result.expiresOn?.getTime() ?? Date.now() + 5 * 60_000 };
      },
    };
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
