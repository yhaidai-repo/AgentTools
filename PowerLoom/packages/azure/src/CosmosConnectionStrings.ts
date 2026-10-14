import type { ArmConnectionString } from "./models/ArmConnectionString";
import { ArmError } from "./models/ArmError";
import type { ConnectionStringAnswer } from "./models/ConnectionStringAnswer";
import { NotSignedInError } from "./models/NotSignedInError";
import type { TokenProvider } from "./models/TokenProvider";
import { readOnlyMongoString } from "./readOnlyMongoString";

const ARM = "https://management.azure.com";
const COSMOS_API_VERSION = "2024-11-15";
const SUBSCRIPTIONS_API_VERSION = "2022-12-01";

// Azure Resource Manager answers these when the token is missing or the account isn't the sign-in's to read.
const DENIED_STATUSES = [401, 403];

interface ArmList<T> {
  value: T[];
}

interface ArmAccount {
  id: string;
  name: string;
}

// A Cosmos DB account's read-only MongoDB connection string, fetched with the vault's sign-in when a tool needs it
// (user decision 2026-10-14: nothing stored). The account is found by name in the vault's subscription, or in every
// subscription the sign-in sees; one fetch per account and run.
export class CosmosConnectionStrings {
  private readonly cache = new Map<string, string>();

  constructor(
    private readonly token: TokenProvider,
    private readonly subscription: string,
  ) {}

  async readOnlyMongo(account: string): Promise<ConnectionStringAnswer> {
    const cached = this.cache.get(account);

    if (cached) {
      return { ok: true, connectionString: cached };
    }

    try {
      return await this.fetch(account);
    } catch (error) {
      return failure(error);
    }
  }

  private async fetch(account: string): Promise<ConnectionStringAnswer> {
    const id = await this.accountId(account);

    if (!id) {
      return { ok: false, message: `No Cosmos DB account named ${account} is visible to the sign-in${this.subscription ? ` in subscription ${this.subscription}` : ""}.`, denied: false };
    }

    const listed = (await this.call("POST", `${id}/listConnectionStrings?api-version=${COSMOS_API_VERSION}`)) as { connectionStrings?: ArmConnectionString[] };
    const connectionString = readOnlyMongoString(listed.connectionStrings ?? []);

    if (!connectionString) {
      return { ok: false, message: `${account} has no read-only MongoDB connection string: is it a Cosmos DB for MongoDB account?`, denied: false };
    }

    this.cache.set(account, connectionString);

    return { ok: true, connectionString };
  }

  private async accountId(account: string): Promise<string | null> {
    const subscriptions = await this.subscriptions();
    const ids = await Promise.all(subscriptions.map((subscription) => this.accountIn(subscription, account)));

    return ids.find((id) => id !== null) ?? null;
  }

  private async subscriptions(): Promise<string[]> {
    if (this.subscription) {
      return [this.subscription];
    }

    const listed = (await this.call("GET", `/subscriptions?api-version=${SUBSCRIPTIONS_API_VERSION}`)) as ArmList<{ subscriptionId: string }>;

    return listed.value.map((subscription) => subscription.subscriptionId);
  }

  private async accountIn(subscription: string, account: string): Promise<string | null> {
    const listed = (await this.call("GET", `/subscriptions/${subscription}/providers/Microsoft.DocumentDB/databaseAccounts?api-version=${COSMOS_API_VERSION}`)) as ArmList<ArmAccount>;

    return listed.value.find((entry) => entry.name.toLowerCase() === account.toLowerCase())?.id ?? null;
  }

  private async call(method: "GET" | "POST", path: string): Promise<unknown> {
    const token = await this.token(ARM);
    const response = await fetch(`${ARM}${path}`, { method, headers: { authorization: `Bearer ${token}` } });

    if (!response.ok) {
      throw new ArmError(response.status, await response.text());
    }

    return response.json();
  }
}

function failure(error: unknown): ConnectionStringAnswer {
  if (error instanceof NotSignedInError) {
    return { ok: false, message: error.message, denied: true };
  }

  const denied = error instanceof ArmError && DENIED_STATUSES.includes(error.status);

  return { ok: false, message: (error as Error).message, denied };
}
