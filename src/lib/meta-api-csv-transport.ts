import { gzipSync } from "node:zlib";
import { ServiceError } from "./service-error";
/** Keep API responses inside the serverless wire limit, just like CSV uploads. */
export function metaApiCsvTransport(csvText: string): { csvText: string } | { csvGzipBase64: string } {
  const bytes = Buffer.from(csvText, "utf8");
  if (bytes.length > 32 * 1024 * 1024) throw new ServiceError("This account returned more than 32 MB of report data. Choose a smaller reporting range.", 422);
  if (bytes.length <= 1_000_000) return { csvText };
  const csvGzipBase64 = gzipSync(bytes).toString("base64");
  if (csvGzipBase64.length > 3_800_000) throw new ServiceError("This account is too large for one API import. Choose a smaller reporting range.", 422);
  return { csvGzipBase64 };
}
