import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsvText } from "../parse-csv";

const HEADERS = ["Campaign name", "Day", "Amount spent (USD)", "Results"];
const ROW = ["Shoes", "22-07-26", "100", "5"];

function buildCsv(delimiter: string, lineEnding: string, bom = false): string {
  const lines = [HEADERS.join(delimiter), ROW.join(delimiter)];
  return (bom ? "﻿" : "") + lines.join(lineEnding) + lineEnding;
}

describe("detectDelimiter", () => {
  it("detects comma", () => {
    expect(detectDelimiter(buildCsv(",", "\n"))).toBe(",");
  });

  it("detects tab (TSV)", () => {
    expect(detectDelimiter(buildCsv("\t", "\n"))).toBe("\t");
  });

  it("detects semicolon (European locale exports)", () => {
    expect(detectDelimiter(buildCsv(";", "\n"))).toBe(";");
  });

  it("picks the most consistent delimiter across multiple rows, not just the first", () => {
    // A campaign name containing a comma (no quoting) would make comma look
    // inconsistent across rows if only counted naively — semicolon should
    // still win cleanly since it's consistent on every line.
    const text = [
      "Campaign name;Day;Amount spent (USD);Results",
      "Shoes, Summer;22-07-26;100;5",
      "Boots;23-07-26;80;3",
    ].join("\n");
    expect(detectDelimiter(text)).toBe(";");
  });

  it("defaults to comma for empty input", () => {
    expect(detectDelimiter("")).toBe(",");
  });
});

describe("parseCsvText — format variations", () => {
  it.each([
    ["comma + LF", ",", "\n", false],
    ["comma + CRLF", ",", "\r\n", false],
    ["tab + LF (TSV)", "\t", "\n", false],
    ["semicolon + LF", ";", "\n", false],
    ["comma + BOM + LF", ",", "\n", true],
    ["comma + BOM + CRLF", ",", "\r\n", true],
  ])("parses %s correctly", (_label, delimiter, lineEnding, bom) => {
    const { colMap, rows, headers } = parseCsvText(buildCsv(delimiter, lineEnding, bom));
    expect(headers[0]).toBe("Campaign name"); // never "﻿Campaign name"
    expect(colMap.campaign_name).toBe("Campaign name");
    expect(colMap.spend).toBe("Amount spent (USD)");
    expect(colMap.results).toBe("Results");
    expect(rows).toHaveLength(1);
    expect(rows[0].campaign_name).toBe("Shoes");
    expect(rows[0].spend).toBe("100");
  });
});
