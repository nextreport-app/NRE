import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { CLARITY_BOOT_SCRIPT, CLARITY_PROJECT_ID, clarityUrlAllowed, clarityDocumentAllowed } from "../clarity";

describe("Clarity consent bootstrap", () => {
  it("initializes only an idempotent queue without fetching a vendor or touching document", () => {
    const window: { clarity?: ((...args: unknown[]) => void) & { q?: unknown[] } } = {};
    runInNewContext(CLARITY_BOOT_SCRIPT, { window });
    const original = window.clarity;
    window.clarity!("consentv2", { analytics_Storage: "granted", ad_Storage: "denied" });
    expect(window.clarity!.q).toHaveLength(1);
    runInNewContext(CLARITY_BOOT_SCRIPT, { window });
    expect(window.clarity).toBe(original); expect(window.clarity!.q).toHaveLength(1);
    expect(CLARITY_PROJECT_ID).toBe("zeg3y17w2d");
  });
  it.each(["https://nextreport.in/", "https://nextreport.in/pricing?utm_source=google&utm_campaign=launch", "https://nextreport.in/privacy"])("allows approved public URL %s", value => {
    expect(clarityUrlAllowed(new URL(value))).toBe(true);
  });
  it.each(["https://nextreport.in/clients", "https://nextreport.in/clients/123/reports/new", "https://nextreport.in/r/private-token", "https://nextreport.in/login", "https://nextreport.in/?email=person@example.com", "https://nextreport.in/?utm_source=person@example.com", "https://nextreport.in/#access_token=secret"])("excludes private or sensitive URL %s", value => {
    expect(clarityUrlAllowed(new URL(value))).toBe(false);
  });
});

it("does not start a recording in a private-origin SPA document or expose private referrers", () => {
 const publicPage = new URL("https://nextreport.in/");
 expect(clarityDocumentAllowed(new URL("https://nextreport.in/clients"), publicPage, "")).toBe(false);
 expect(clarityDocumentAllowed(publicPage, publicPage, "https://nextreport.in/r/private-token")).toBe(false);
 expect(clarityDocumentAllowed(publicPage, publicPage, "https://search.example/?email=person@example.com")).toBe(false);
 expect(clarityDocumentAllowed(publicPage, publicPage, "https://search.example/")).toBe(true);
});
