import { inflateRawSync } from "node:zlib";
import { ServiceError } from "../service-error";
const MAX_EXPANDED_BYTES = 32 * 1024 * 1024;
/** Inspect ZIP directory sizes before SheetJS decompresses XML. No truncation of financial rows. */
export function assertWorkbookUploadBudget(buffer: Buffer): void {
  if (buffer.length < 2) return;
  if (buffer.readUInt16LE(0) !== 0x4b50) return;
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new ServiceError("Workbook ZIP directory is invalid.", 400);
  const entries = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  if (entries > 2000) throw new ServiceError("Workbook has too many internal files. Export CSV instead.", 413);
  let expanded = 0;
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) throw new ServiceError("Workbook ZIP directory is invalid.", 400);
    expanded += buffer.readUInt32LE(offset + 24);
    if (expanded > MAX_EXPANDED_BYTES) throw new ServiceError("Expanded workbook exceeds 32 MB. Export a smaller CSV instead.", 413);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const compressedBytes = buffer.readUInt32LE(offset + 20);
    const method = buffer.readUInt16LE(offset + 10);
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new ServiceError("Workbook ZIP entry is invalid.", 400);
    const dataOffset = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    if (dataOffset + compressedBytes > buffer.length) throw new ServiceError("Workbook ZIP entry is truncated.", 400);
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedBytes);
    let actualBytes: number;
    try {
      actualBytes = method === 0 ? compressed.length : method === 8 ? inflateRawSync(compressed, { maxOutputLength: MAX_EXPANDED_BYTES }).length : -1;
    } catch { throw new ServiceError("Workbook cannot be safely expanded. Export CSV instead.", 413); }
    if (actualBytes !== buffer.readUInt32LE(offset + 24)) throw new ServiceError("Workbook expanded size does not match its directory.", 400);
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
}
