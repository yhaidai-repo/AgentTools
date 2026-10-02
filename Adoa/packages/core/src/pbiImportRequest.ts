import type { Outcome } from "./models/Outcome";
import type { PbiImportRequest } from "./models/PbiImportRequest";

// A request from outside (an import inbox file, a queue message): checked field by field, because any tool may write it.
// A file without a sourceRef uses its file name.
export function parseImportRequest(value: unknown, fallbackRef: string | null = null): Outcome<PbiImportRequest> {
  if (!isObject(value)) {
    return { ok: false, error: "The request isn't a JSON object." };
  }

  const request: PbiImportRequest = {
    source: optionalText(value.source) ?? "",
    sourceRef: optionalText(value.sourceRef) ?? fallbackRef ?? "",
    title: optionalText(value.title),
    from: optionalText(value.from),
    occurredAt: optionalText(value.occurredAt),
    adoIds: Array.isArray(value.adoIds) ? (value.adoIds as number[]) : undefined,
    html: optionalText(value.html),
    text: optionalText(value.text),
    prepare: value.prepare === undefined ? undefined : value.prepare === true,
  };
  const problem = requestProblem(request);

  return problem ? { ok: false, error: problem } : { ok: true, value: request };
}

function requestProblem(request: PbiImportRequest): string | null {
  if (!request.source || !request.sourceRef) {
    return "source and sourceRef are required.";
  }

  if (request.adoIds && !request.adoIds.every((id) => Number.isInteger(id) && id > 0)) {
    return "adoIds must be whole numbers above 0.";
  }

  if (request.occurredAt && Number.isNaN(Date.parse(request.occurredAt))) {
    return "occurredAt isn't a date.";
  }

  const namesPbis = (request.adoIds?.length ?? 0) > 0 || !!request.html || !!request.text;

  return namesPbis ? null : "Give adoIds, html or text.";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
