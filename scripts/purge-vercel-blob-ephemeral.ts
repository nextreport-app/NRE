/**
 * One-off maintenance: delete ephemeral wizard blobs (upload-session JSON + drafts).
 * Does NOT delete generated reports, logos, previous-month CSVs, or support attachments.
 *
 * Usage (from repo root, with production token):
 *   vercel env pull .env.local --environment=production
 *   npx tsx scripts/purge-vercel-blob-ephemeral.ts
 *
 * Optional: PURGE_MAX=10000 npx tsx scripts/purge-vercel-blob-ephemeral.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { purgeAllEphemeralWizardBlobs } from "../src/lib/wizard-storage-cleanup";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    console.error("Missing BLOB_READ_WRITE_TOKEN. Run: vercel env pull .env.local --environment=production");
    process.exit(1);
  }

  const max = Number(process.env.PURGE_MAX ?? "5000");
  console.log(`Purging ephemeral wizard blobs (max ${max} deletions)…`);
  const result = await purgeAllEphemeralWizardBlobs(max);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
