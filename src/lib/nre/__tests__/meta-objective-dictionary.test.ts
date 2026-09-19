import { describe, expect, it } from "vitest";
import {
  DEFINITIVE_PROOF_ALIAS_TO_KEY,
  META_API_ACTION_TO_CSV,
  META_OBJECTIVE_SPECS,
  buildResultTypeMap,
  metaApiActionToCsvResultType,
  resolveDefinitiveObjectiveFromRows,
  resolveUniqueMappedObjectiveFromRows,
} from "../meta-objective-dictionary";
import { resolveObjectiveFromResultType } from "../result-type-map";

describe("meta-objective-dictionary — universal alias coverage", () => {
  it("maps common human-readable CSV export labels via RESULT_TYPE_MAP", () => {
    const humanLabels: Array<[string, string]> = [
      ["Website leads", "WEBSITE LEADS"],
      ["website submission", "WEBSITE LEADS"],
      ["Website purchases", "PURCHASES"],
      ["Landing page views", "LANDING PAGE VIEWS"],
      ["Link clicks", "LINK CLICKS"],
      ["App installs", "APP INSTALLS"],
      ["Post engagements", "POST ENGAGEMENTS"],
      ["Complete registration", "REGISTRATIONS"],
      ["Submit application", "APPLICATIONS"],
      ["Add payment info", "PAYMENT INFO"],
      ["Schedule", "APPOINTMENT LEADS"],
      ["Adds to cart", "ADD TO CART"],
      ["Checkouts initiated", "INITIATE CHECKOUT"],
      ["Quote Request Submitted", "QUOTE REQUESTS"],
      ["quote requests submitted", "QUOTE REQUESTS"],
      ["omni_purchase", "PURCHASES"],
      ["omni_app_install", "APP INSTALLS"],
    ];
    for (const [input, label] of humanLabels) {
      expect(resolveObjectiveFromResultType(input)?.resultLabel, input).toBe(label);
    }
  });

  it("API action types map to the same CSV labels the manual export uses", () => {
    expect(metaApiActionToCsvResultType("omni_purchase")).toBe("Purchase");
    expect(metaApiActionToCsvResultType("offsite_conversion.fb_pixel_lead")).toBe("Website leads");
    expect(metaApiActionToCsvResultType("onsite_conversion.lead_grouped")).toBe("Leads (form)");
    expect(metaApiActionToCsvResultType("offsite_conversion.fb_pixel_complete_registration")).toBe(
      "Complete registration",
    );
    expect(META_API_ACTION_TO_CSV["landing_page_view"]).toBe("Landing page view");
  });

  it("Step 0 definitive proof picks deepest funnel when multiple proof types exist", () => {
    const rows = [
      { result_type: "initiate checkout" },
      { result_type: "website purchases" },
      { result_type: "" },
    ];
    const info = resolveDefinitiveObjectiveFromRows(rows, resolveObjectiveFromResultType);
    expect(info?.resultLabel).toBe("PURCHASES");
  });

  it("unique-mapped shortcut trusts one objective when all typed rows agree (blank majority)", () => {
    const rows = [
      { result_type: "website submission" },
      { result_type: "website submission" },
      { result_type: "" },
      { result_type: "" },
      { result_type: "" },
    ];
    const info = resolveUniqueMappedObjectiveFromRows(rows, resolveObjectiveFromResultType);
    expect(info?.resultLabel).toBe("WEBSITE LEADS");
  });

  it("every spec alias lowercases uniquely into buildResultTypeMap (last alias wins on collision)", () => {
    const map = buildResultTypeMap();
    for (const spec of META_OBJECTIVE_SPECS) {
      for (const alias of spec.aliases) {
        expect(map[alias.toLowerCase()].key).toBe(spec.key);
      }
    }
  });

  it("definitive proof aliases cover all sales + lead families", () => {
    expect(DEFINITIVE_PROOF_ALIAS_TO_KEY.get("website submission")).toBe("website_leads");
    expect(DEFINITIVE_PROOF_ALIAS_TO_KEY.get("leads (form)")).toBe("meta_form_leads");
    expect(DEFINITIVE_PROOF_ALIAS_TO_KEY.get("website purchases")).toBe("purchases");
    expect(DEFINITIVE_PROOF_ALIAS_TO_KEY.get("checkouts initiated")).toBe("initiate_checkout");
  });
});
