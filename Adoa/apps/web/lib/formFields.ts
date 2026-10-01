import type { UploadedFile } from "@adoa/attachments";

export async function readUpload(form: FormData): Promise<UploadedFile | null> {
  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  return { fileName: file.name, contentType: file.type, bytes: Buffer.from(await file.arrayBuffer()) };
}

export function formText(form: FormData, name: string): string | null {
  const value = String(form.get(name) ?? "").trim();

  return value.length > 0 ? value : null;
}

// One entry per non-empty line, e.g. a finding's default or options.
export function formLines(form: FormData, name: string): string[] {
  return String(form.get(name) ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
}

// Items of no PBI (e.g. a chat draft's tech-writer task) send an empty adoId.
export function formAdoId(form: FormData): number | null {
  const value = formText(form, "adoId");

  return value === null ? null : Number(value);
}
