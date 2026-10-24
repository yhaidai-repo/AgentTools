const PREFIX = "ATT-";

// Attachments are referred to as ATT-<id> everywhere: agents, the web and the Vault.
export function attachmentRef(id: number): string {
  return `${PREFIX}${id}`;
}

export function parseAttachmentRef(ref: string): number | null {
  const id = Number(ref.trim().toUpperCase().replace(PREFIX, ""));

  return Number.isInteger(id) && id > 0 ? id : null;
}
