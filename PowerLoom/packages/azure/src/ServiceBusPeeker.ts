import { ServiceBusClient, isServiceBusError, type ServiceBusReceiver } from "@azure/service-bus";
import { NotSignedInError } from "./models/NotSignedInError";
import type { ServiceBusAnswer } from "./models/ServiceBusAnswer";
import type { ServiceBusPeek } from "./models/ServiceBusPeek";
import type { TokenProvider } from "./models/TokenProvider";
import { messageSummary } from "./serviceBusMessages";

// The API the sign-in's token is for.
const SERVICE_BUS_RESOURCE = "https://servicebus.azure.net";

// What one peek may return (the design's cap): messages stay in place whatever the count.
const MAX_MESSAGES = 20;
const PEEK_TIMEOUT_MS = 30_000;

// The namespace answers this when the sign-in lacks the Data Receiver role on the entity.
const DENIED_CODE = "UnauthorizedAccess";

// Peeks queues and subscriptions with the vault's sign-in (user decision 2026-10-14): `peekMessages` only, which
// reads without locking or settling, so nothing is ever received; the dead-letter sub-queue on request. One client
// per call.
export class ServiceBusPeeker {
  constructor(private readonly token: TokenProvider) {}

  async peek(request: ServiceBusPeek): Promise<ServiceBusAnswer> {
    // No retries: the SDK retries a refused claim ('Listen' required) until the timeout, which would hide the refusal.
    const client = new ServiceBusClient(request.namespace, { getToken: (scopes) => this.tokenFor(scopes) }, { retryOptions: { maxRetries: 0 } });
    const receiver = receiverOf(client, request);

    try {
      const messages = await receiver.peekMessages(Math.min(Math.max(request.count, 1), MAX_MESSAGES), { abortSignal: AbortSignal.timeout(PEEK_TIMEOUT_MS) });

      return { ok: true, messages: messages.map(messageSummary) };
    } catch (error) {
      return failure(error);
    } finally {
      await receiver.close().catch(() => undefined);
      await client.close().catch(() => undefined);
    }
  }

  // The SDK asks for its scope; the sign-in answers with a token for the Service Bus API.
  private async tokenFor(scopes: string | string[]): Promise<{ token: string; expiresOnTimestamp: number }> {
    const token = await this.token(resourceOf(scopes));

    return { token: token.accessToken, expiresOnTimestamp: token.expires_on * 1000 };
  }
}

function receiverOf(client: ServiceBusClient, request: ServiceBusPeek): ServiceBusReceiver {
  const options = { receiveMode: "peekLock" as const, subQueueType: request.deadLetter ? ("deadLetter" as const) : undefined };

  return request.subscription ? client.createReceiver(request.entity, request.subscription, options) : client.createReceiver(request.entity, options);
}

function resourceOf(scopes: string | string[]): string {
  const scope = Array.isArray(scopes) ? scopes[0] : scopes;

  return scope?.replace(/\/\.default$/, "") || SERVICE_BUS_RESOURCE;
}

function failure(error: unknown): ServiceBusAnswer {
  if (error instanceof NotSignedInError) {
    return { ok: false, message: error.message, denied: true };
  }

  const denied = isServiceBusError(error) && error.code === DENIED_CODE;

  return { ok: false, message: (error as Error).message, denied };
}
