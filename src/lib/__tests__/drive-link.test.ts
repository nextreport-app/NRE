import { describe, expect, it } from "vitest";
import { extractDriveFolderIdFromLink } from "../drive-link";

describe("extractDriveFolderIdFromLink", () => {
  it("extracts the id from a plain folder link", () => {
    expect(extractDriveFolderIdFromLink("https://drive.google.com/drive/folders/1ABC123xyz")).toBe("1ABC123xyz");
  });

  it("extracts the id from a link with a trailing query string (e.g. ?usp=sharing)", () => {
    expect(extractDriveFolderIdFromLink("https://drive.google.com/drive/folders/1ABC123xyz?usp=sharing")).toBe(
      "1ABC123xyz",
    );
  });

  it("extracts the id from a link with the /u/0/ multi-account segment", () => {
    expect(extractDriveFolderIdFromLink("https://drive.google.com/drive/u/0/folders/1ABC123xyz")).toBe("1ABC123xyz");
  });

  it("accepts a bare folder id pasted directly, with no URL at all", () => {
    expect(extractDriveFolderIdFromLink("1ABC123xyz456def")).toBe("1ABC123xyz456def");
  });

  it("trims surrounding whitespace", () => {
    expect(extractDriveFolderIdFromLink("  https://drive.google.com/drive/folders/1ABC123xyz  ")).toBe("1ABC123xyz");
  });

  it("returns null for an empty or blank input", () => {
    expect(extractDriveFolderIdFromLink("")).toBeNull();
    expect(extractDriveFolderIdFromLink("   ")).toBeNull();
  });

  it("returns null for a link that isn't a folder link at all", () => {
    expect(extractDriveFolderIdFromLink("https://drive.google.com/file/d/1ABC123xyz/view")).toBeNull();
  });

  it("returns null for a short, obviously-not-an-id string", () => {
    expect(extractDriveFolderIdFromLink("not a link")).toBeNull();
  });
});
