import { createHash } from "node:crypto";
export interface ArchiveFile { path: string; content: Buffer }
// Deterministic ZIP with stored entries; never reads arbitrary host files.
export function guideZip(files: ArchiveFile[]): Buffer {
  const parts: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    if (!/^(?:images\/[a-z0-9][a-z0-9-]*\.png|guide\.md|manifest\.json|verification\.md|publish-task\.md)$/.test(f.path)) throw new Error("Invalid guide archive path");
    const name = Buffer.from(f.path), crc = crc32(f.content), h = Buffer.alloc(30), c = Buffer.alloc(46);
    h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x800, 6); h.writeUInt16LE(33, 12);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(f.content.length, 18); h.writeUInt32LE(f.content.length, 22); h.writeUInt16LE(name.length, 26);
    parts.push(h, name, f.content);
    c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x800, 8); c.writeUInt16LE(33, 14);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(f.content.length, 20); c.writeUInt32LE(f.content.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, name); offset += h.length + name.length + f.content.length;
  }
  const dir = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}
export function guideChecksum(files: ArchiveFile[]): string {
  const hash = createHash("sha256");
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) hash.update(f.path + "\0").update(createHash("sha256").update(f.content).digest("hex") + "\n");
  return hash.digest("hex");
}
function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const b of bytes) { crc ^= b; for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
