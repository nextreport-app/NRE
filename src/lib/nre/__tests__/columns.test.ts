import { describe, expect, it } from "vitest";
import { getRowDate, readRowsWithAutoMap, type NreRow } from "../columns";

describe("getRowDate", () => {
  it("prefers an exact 'Day' header over decoy date-ish columns (regression)", () => {
    // Reproduces the reported CSV shape: Day (the real per-row date), Starts
    // (campaign start — constant per campaign), Ends (campaign end, often
    // "Ongoing" text), and Reporting starts/ends (export range — constant
    // across every row). Only Day should ever be read.
    const { rows } = readRowsWithAutoMap(
      ["Campaign name", "Day", "Starts", "Ends", "Reporting starts", "Reporting ends", "Amount spent (USD)"],
      [["Shoes", "22-07-26", "01-05-26", "Ongoing", "01-07-26", "22-07-26", "100"]],
    );
    expect(getRowDate(rows[0])).toBe("22-07-26");
  });

  it("is case- and whitespace-insensitive on the header name", () => {
    const row: NreRow = { _raw: { " DAY ": "22-07-26", "Reporting starts": "01-07-26" } };
    expect(getRowDate(row)).toBe("22-07-26");
  });

  it("falls back to a 'Date' header when there is no 'Day' column", () => {
    const row: NreRow = { _raw: { Date: "22-07-26", "Reporting starts": "01-07-26" } };
    expect(getRowDate(row)).toBe("22-07-26");
  });

  it("never matches 'Starts'/'Ends'/'Reporting starts'/'Reporting ends' as substrings of day/date", () => {
    const row: NreRow = {
      _raw: { Starts: "01-05-26", Ends: "Ongoing", "Reporting starts": "01-07-26", "Reporting ends": "22-07-26" },
      date_start: "01-07-26",
    };
    // No real Day/Date column exists, so this correctly falls all the way
    // back to date_start (Reporting starts) — not to Starts or Ends.
    expect(getRowDate(row)).toBe("01-07-26");
  });

  it("falls back to date_start only when no Day/Date column exists at all", () => {
    const row: NreRow = { _raw: { "Reporting starts": "01-07-26" }, date_start: "01-07-26" };
    expect(getRowDate(row)).toBe("01-07-26");
  });
});
