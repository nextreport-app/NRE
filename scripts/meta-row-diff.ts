/** Run from repo root: npx tsx scripts/meta-row-diff.ts --manual manual.csv --api-csv api.csv [--since ISO --until ISO] [--out diff.json] */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { csvEvidence, diffRows, insightEvidence } from "./lib/meta-row-diff";

try {
  const args = process.argv.slice(2);
  const allowed = new Set(["--manual", "--api-csv", "--insights", "--since", "--until", "--out"]);
  const opts: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!allowed.has(args[i]) || !args[i + 1] || args[i + 1].startsWith("--") || opts[args[i]]) throw new Error(`Invalid argument: ${args[i]}`);
    opts[args[i]] = args[i + 1];
  }
  if (!opts["--manual"] || Boolean(opts["--api-csv"]) === Boolean(opts["--insights"])) {
    throw new Error("Use --manual manual.csv and exactly one of --api-csv api.csv or --insights insights.json");
  }
  const since = opts["--since"], until = opts["--until"];
  if (Boolean(since) !== Boolean(until) || (since && (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until) || since > until))) {
    throw new Error("Supply both --since and --until as ordered ISO dates");
  }
  const manualText = readFileSync(opts["--manual"], "utf8");
  const apiText = readFileSync(opts["--insights"] ?? opts["--api-csv"], "utf8");
  const manual = csvEvidence(manualText);
  const mapped = opts["--insights"] ? insightEvidence(JSON.parse(apiText)) : null;
  const api = mapped?.rows ?? csvEvidence(apiText);
  const filter = (rows: typeof manual) => since ? rows.filter(r => r.day >= since && r.day <= until) : rows;
  const compared = diffRows(filter(manual), filter(api));
  if (!compared.rows.length) throw new Error("No records in the requested window");
  const result = {
    inputSha256: {
      manual: createHash("sha256").update(manualText).digest("hex"),
      api: createHash("sha256").update(apiText).digest("hex"),
    },
    window: since ? { since, until } : "all supplied rows; out-of-window rows remain visible as unmatched",
    rawCounts: { manual: manual.length, api: api.length },
    ...compared,
    ...(mapped ? { mapperEvidence: mapped.decisions } : {}),
    limits: ["Name keys cannot establish identity after renames or distinguish different IDs sharing a name.", "CSV-only mode compares saved artifacts, not today's mapper. Raw Insights mode runs today's mapper without upstream enrichment.", "Matching rows do not establish matching timezone, attribution window, API version, currency or snapshot time; capture those alongside inputs.", "Result type aliases are not silently equated; inspect label-only differences."],
  };
  const json = JSON.stringify(result, null, 2) + "\n";
  if (opts["--out"]) writeFileSync(opts["--out"], json, { flag: "wx" });
  else process.stdout.write(json);
  process.exitCode = compared.rows.some(r => r.status !== "equal") ? 1 : 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
}
