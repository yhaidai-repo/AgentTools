import { ClientSecretCredential } from "@azure/identity";
import type { AzureIdentity } from "./models/AzureIdentity";
import type { AzureIdentityCheck } from "./models/AzureIdentityCheck";

// Any service principal can get a token for Resource Manager, roles or not: this proves the tenant, client id and
// secret. Whether the roles are assigned shows when a resource is read.
const MANAGEMENT_SCOPE = "https://management.azure.com/.default";

export async function checkAzureIdentity(identity: AzureIdentity): Promise<AzureIdentityCheck> {
  try {
    const token = await credentialOf(identity).getToken(MANAGEMENT_SCOPE);
    const expires = new Date(token.expiresOnTimestamp).toISOString();

    return { ok: true, message: `Signed in as ${identity.clientId} in tenant ${identity.tenantId}; the token expires ${expires}.` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

export function credentialOf(identity: AzureIdentity): ClientSecretCredential {
  return new ClientSecretCredential(identity.tenantId, identity.clientId, identity.clientSecret);
}
