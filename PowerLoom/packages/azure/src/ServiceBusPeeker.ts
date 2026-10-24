import { ServiceBusClient, isServiceBusError, type ServiceBusReceiver } from "@azure/service-bus";
import type { ServiceBusAnswer } from "./models/ServiceBusAnswer";
import type { ServiceBusPeek } from "./models/ServiceBusPeek";
import { messageSummary } from "./serviceBusMessages";

// What one peek may return (the design's cap): messages stay in place whatever the count.
const MAX_MESSAGES = 20;
const PEEK_TIMEOUT_MS = 30_000;

// The namespace answers this for a wrong or rotated key, or a policy without Listen.
const DENIED_CODE = "UnauthorizedAccess";

// Peeks queues and subscriptions with the namespace's own Listen-only connection string (user decision 2026-10-14):
// `peekMessages` only, which reads without locking or settling, so nothing is ever received; the dead-letter
// sub-queue on request. One client per call.
export class ServiceBusPeeker {
  async peek(request: ServiceBusPeek): Promise<ServiceBusAnswer> {
    // No retries: the SDK retries a refused claim until the timeout, which would hide the refusal.
    const client = new ServiceBusClient(request.connectionString, { retryOptions: { maxRetries: 0 } });
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
}

function receiverOf(client: ServiceBusClient, request: ServiceBusPeek): ServiceBusReceiver {
  const options = { receiveMode: "peekLock" as const, subQueueType: request.deadLetter ? ("deadLetter" as const) : undefined };

  return request.subscription ? client.createReceiver(request.entity, request.subscription, options) : client.createReceiver(request.entity, options);
}

function failure(error: unknown): ServiceBusAnswer {
  const denied = isServiceBusError(error) && error.code === DENIED_CODE;

  return { ok: false, message: (error as Error).message, denied };
}
