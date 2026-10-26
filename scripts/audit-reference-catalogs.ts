/** Offline workbook comparison. Usage: npx tsx scripts/audit-reference-catalogs.ts --metrics metrics.xlsx --objectives objectives.xlsx --out audit.json */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import * as XLSX from "xlsx";
import { META_OBJECTIVE_SPECS } from "../src/lib/nre/meta-objective-dictionary";
import { findMetaMetric } from "../src/lib/nre/meta-dictionary";
import { findGoogleMetric } from "../src/lib/nre/google-dictionary";
import { buildColumnMap } from "../src/lib/nre/columns";
import { buildGoogleColumnMap } from "../src/lib/nre/google-columns";
import { REPORT_ENGINE_VERSION } from "../src/lib/nre/calculation-context";
import { resolveObjectiveFromResultType } from "../src/lib/nre/result-type-map";

const options: Record<string, string> = {};
try {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    if (!["--metrics", "--objectives", "--out"].includes(args[i]) || !args[i + 1] || options[args[i]]) throw new Error("Use --metrics metrics.xlsx --objectives objectives.xlsx --out audit.json");
    options[args[i]] = args[i + 1];
  }
  if (!options["--metrics"] || !options["--objectives"] || !options["--out"]) throw new Error("Use --metrics metrics.xlsx --objectives objectives.xlsx --out audit.json");
  const sources = ["--metrics", "--objectives"].map(key => {
    const bytes = readFileSync(options[key]);
    const workbook = XLSX.read(bytes, { type: "buffer" });
    return { role: key.slice(2), file: basename(options[key]), sha256: createHash("sha256").update(bytes).digest("hex"), tabs: workbook.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[name], { header: 1, defval: "", raw: false }) })) };
  });
  const entries = sources[0].tabs.flatMap(tab => {
    const header = tab.rows[0] ?? [];
    return header.flatMap((title, column) => {
      const platform = /^meta metrics/i.test(title) ? "META" : /^google metrics/i.test(title) ? "GOOGLE" : null;
      if (!platform) return [];
      return tab.rows.slice(1).flatMap((row, index) => {
        const original = String(row[column] ?? "").trim();
        if (!original) return [];
        const definition = platform === "META" ? findMetaMetric(original) : findGoogleMetric(original);
        const fixed = Object.keys(platform === "META" ? buildColumnMap([original]) : buildGoogleColumnMap([original]));
        return [{ platform, sheet: tab.name, cell: XLSX.utils.encode_cell({ r: index + 1, c: column }), header: original,
          status: definition ? ["primary", "secondary"].includes(definition.type) ? "registered_metric" : "registered_nonmetric" : fixed.length ? "fixed_parser_only" : "not_registered",
          fixedFields: fixed,
          binding: definition ? { key: definition.key, type: definition.type, format: definition.format, perUnitOf: definition.perUnitOf, perUnitScale: definition.perUnitScale, numeratorKey: definition.numeratorKey, denominatorKey: definition.denominatorKey, ratioScale: definition.ratioScale } : null }];
      });
    });
  });
  const objectiveTabs = sources[1].tabs.map(tab => ({ name: tab.name, nonemptyRows: tab.rows.flatMap((cells, index) => cells.some(cell => String(cell).trim()) ? [{ row: index + 1, cells }] : []) }));
  const events = objectiveTabs.flatMap(tab => {
    const seen = new Set<string>();
    return tab.nonemptyRows.flatMap(({ row, cells }) => {
      const event = String(cells[4] ?? "").trim();
      if (!event || event === "Conversion event" || seen.has(event.toLowerCase())) return [];
      seen.add(event.toLowerCase());
      return [{ sheet: tab.name, cell: `E${row}`, event, status: event.toLowerCase() === "lead" ? "location_context_required" : event.toLowerCase() === "conversion count" ? "generic_count_placeholder" : "registered_event", resolution: resolveObjectiveFromResultType(event) }];
    });
  });
  const counts = (platform: string) => {
    const rows = entries.filter(entry => entry.platform === platform);
    return { listedRows: rows.length, uniqueHeaders: new Set(rows.map(row => row.header.toLowerCase())).size, statuses: Object.fromEntries(["registered_metric", "registered_nonmetric", "fixed_parser_only", "not_registered"].map(status => [status, rows.filter(row => row.status === status).length])) };
  };
  const summary = { META: counts("META"), GOOGLE: counts("GOOGLE"), distinctReferenceEvents: events.length, registeredEventFamilies: META_OBJECTIVE_SPECS.length };
  const result = { engineVersion: REPORT_ENGINE_VERSION, sources: sources.map(source => ({ role: source.role, file: source.file, sha256: source.sha256, tabs: source.tabs.map(tab => ({ name: tab.name, rowCount: tab.rows.length })) })), summary, entries, objectiveTabs, events,
    limits: ["Registered means a dictionary binding exists, not that every aggregate is independently validated.", "Fixed-parser-only identifies a candidate structural/core binding, not an optional metric card.", "The reference lists names, not complete numerator/denominator, attribution, currency, grain or unique-audience contracts.", "Blank hierarchical cells are preserved; this audit does not assume every inherited goal/event combination is a valid platform configuration.", "Unknown fields are not silently promoted to supported metrics. API parity is outside this audit."] };
  writeFileSync(options["--out"], JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  process.stdout.write(JSON.stringify(summary) + "\n");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
}
