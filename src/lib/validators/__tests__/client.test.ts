import { describe, expect, it } from "vitest";
import { CURRENCIES, clientSchema, SELECTABLE_CURRENCIES, TIMEZONE_GROUPS, TIMEZONES } from "../client";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";

describe("CURRENCIES", () => {
  it("includes every requested new currency alongside the original set", () => {
    expect(CURRENCIES).toEqual([
      "INR",
      "USD",
      "GBP",
      "AUD",
      "CAD",
      "AED",
      "NZD",
      "SGD",
      "MYR",
      "PHP",
      "ZAR",
      "BRL",
      "MXN",
      "EUR",
    ]);
  });

  it("has a CURRENCY_SYMBOLS entry for every currency, and no extras", () => {
    expect(Object.keys(CURRENCY_SYMBOLS).sort()).toEqual([...CURRENCIES].sort());
  });

  it("uses the requested symbols for the newly added currencies", () => {
    expect(CURRENCY_SYMBOLS.NZD).toBe("NZ$");
    expect(CURRENCY_SYMBOLS.SGD).toBe("S$");
    expect(CURRENCY_SYMBOLS.MYR).toBe("RM");
    expect(CURRENCY_SYMBOLS.PHP).toBe("₱");
    expect(CURRENCY_SYMBOLS.ZAR).toBe("R");
    expect(CURRENCY_SYMBOLS.BRL).toBe("R$");
    expect(CURRENCY_SYMBOLS.MXN).toBe("MX$");
    expect(CURRENCY_SYMBOLS.EUR).toBe("€");
  });
});

describe("SELECTABLE_CURRENCIES", () => {
  it("excludes ZAR, BRL, and MXN from the client form's dropdown", () => {
    expect(SELECTABLE_CURRENCIES).not.toContain("ZAR");
    expect(SELECTABLE_CURRENCIES).not.toContain("BRL");
    expect(SELECTABLE_CURRENCIES).not.toContain("MXN");
  });

  it("keeps every other currency selectable", () => {
    for (const c of CURRENCIES) {
      if (c === "ZAR" || c === "BRL" || c === "MXN") continue;
      expect(SELECTABLE_CURRENCIES).toContain(c);
    }
  });

  it("still accepts ZAR/BRL/MXN in the schema — only the UI dropdown is restricted, not the Prisma enum", () => {
    for (const currency of ["ZAR", "BRL", "MXN"] as const) {
      const result = clientSchema.safeParse({
        accountName: "Test Client",
        currency,
        timezone: "Asia/Kolkata",
        template: "DARK",
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("clientSchema", () => {
  it.each(CURRENCIES)("accepts %s as a valid currency", (currency) => {
    const result = clientSchema.safeParse({
      accountName: "Test Client",
      currency,
      timezone: "Asia/Kolkata",
      template: "DARK",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a currency outside the enum", () => {
    const result = clientSchema.safeParse({
      accountName: "Test Client",
      currency: "JPY",
      timezone: "Asia/Kolkata",
      template: "DARK",
    });
    expect(result.success).toBe(false);
  });
});

describe("TIMEZONE_GROUPS", () => {
  const ALL_REQUESTED_TIMEZONES = [
    "America/Toronto",
    "America/Vancouver",
    "America/Edmonton", // Calgary's canonical IANA zone — see TIMEZONE_GROUPS
    "America/Halifax",
    "America/Denver",
    "America/Phoenix",
    "America/Anchorage",
    "Pacific/Auckland",
    "Asia/Singapore",
    "Asia/Bangkok",
    "Asia/Manila",
  ];

  const REMOVED_TIMEZONES = [
    "Asia/Karachi",
    "Asia/Dhaka",
    "Africa/Johannesburg",
    "America/Sao_Paulo",
    "America/Mexico_City",
  ];

  it("includes every newly requested timezone", () => {
    for (const tz of ALL_REQUESTED_TIMEZONES) {
      expect(TIMEZONES).toContain(tz);
    }
  });

  it("no longer offers the removed timezones (Pakistan, Bangladesh, South Africa, Brazil, Mexico)", () => {
    for (const tz of REMOVED_TIMEZONES) {
      expect(TIMEZONES).not.toContain(tz);
    }
    for (const region of ["Pakistan", "Bangladesh", "South Africa", "Brazil", "Mexico"]) {
      expect(TIMEZONE_GROUPS.some((g) => g.region === region)).toBe(false);
    }
  });

  it("keeps every pre-existing timezone", () => {
    for (const tz of ["Asia/Kolkata", "America/Chicago", "America/New_York", "America/Los_Angeles", "Europe/London", "Australia/Sydney", "Asia/Dubai"]) {
      expect(TIMEZONES).toContain(tz);
    }
  });

  it("has no duplicate timezone values across groups", () => {
    expect(new Set(TIMEZONES).size).toBe(TIMEZONES.length);
  });

  it("every zone value is a valid IANA identifier Intl can format", () => {
    for (const tz of TIMEZONES) {
      expect(() => new Intl.DateTimeFormat("en-US", { timeZone: tz })).not.toThrow();
    }
  });

  it("every group has a flag and at least one zone", () => {
    for (const group of TIMEZONE_GROUPS) {
      expect(group.flag.length).toBeGreaterThan(0);
      expect(group.zones.length).toBeGreaterThan(0);
    }
  });

  it("also includes the Melbourne/Perth zones the Display format section listed under Australia", () => {
    expect(TIMEZONES).toContain("Australia/Melbourne");
    expect(TIMEZONES).toContain("Australia/Perth");
  });

  it("labels the Calgary option 'Calgary (MST)' even though its value is the canonical America/Edmonton zone", () => {
    const canada = TIMEZONE_GROUPS.find((g) => g.region === "Canada")!;
    const calgary = canada.zones.find((z) => z.value === "America/Edmonton")!;
    expect(calgary.label).toBe("Calgary (MST)");
  });
});
