import type { ServiceBusMessage } from "./models/ServiceBusMessage";

// One message's body is cut here; the agent asks for fewer messages or a narrower subject to see more.
const MAX_BODY_CHARS = 4_000;

// What the SDK hands out, reduced to what the agent needs; `body` is already decoded when it was sent as JSON.
export interface ReceivedMessageLike {
  sequenceNumber?: { toString(): string } | number | bigint;
  messageId?: string | number | Buffer;
  enqueuedTimeUtc?: Date;
  subject?: string;
  contentType?: string;
  deliveryCount?: number;
  correlationId?: string | number | Buffer;
  deadLetterReason?: string;
  applicationProperties?: Record<string, unknown>;
  body: unknown;
}

export function messageSummary(message: ReceivedMessageLike): ServiceBusMessage {
  return {
    sequenceNumber: message.sequenceNumber === undefined ? "" : String(message.sequenceNumber),
    messageId: textOrNull(message.messageId),
    enqueuedTime: message.enqueuedTimeUtc?.toISOString() ?? null,
    subject: message.subject ?? null,
    contentType: message.contentType ?? null,
    deliveryCount: message.deliveryCount ?? null,
    correlationId: textOrNull(message.correlationId),
    deadLetterReason: message.deadLetterReason ?? null,
    applicationProperties: message.applicationProperties ?? {},
    body: bodyOf(message.body),
  };
}

// Bytes are read as UTF-8 and parsed as JSON when they are JSON; anything else stays as it is, cut when long.
function bodyOf(body: unknown): unknown {
  const text = Buffer.isBuffer(body) ? body.toString("utf8") : typeof body === "string" ? body : null;

  if (text === null) {
    return cutValue(body);
  }

  return cutValue(parsed(text));
}

function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function cutValue(value: unknown): unknown {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";

  if (text.length <= MAX_BODY_CHARS) {
    return value;
  }

  return `${text.slice(0, MAX_BODY_CHARS)}… [cut at ${MAX_BODY_CHARS} of ${text.length} characters]`;
}

function textOrNull(value: string | number | Buffer | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  return Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
}
