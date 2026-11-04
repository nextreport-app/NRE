import { afterEach, describe, expect, it, vi } from "vitest";
import {
  encryptMetaToken,
  decryptMetaToken,
  isEncryptedMetaToken,
} from "../meta-token-storage";
afterEach(() => vi.unstubAllEnvs());
describe("Meta token storage", () => {
  it("encrypts with unique authenticated envelopes, without storing the token in cleartext", () => {
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("META_TOKEN_ENCRYPTION_KEY", "");
    const one = encryptMetaToken("private-access-token"),
      two = encryptMetaToken("private-access-token");
    expect(one).not.toBe(two);
    expect(one).not.toContain("private-access-token");
    expect(isEncryptedMetaToken(one)).toBe(true);
    expect(decryptMetaToken(one)).toBe("private-access-token");
    const parts = one.split(".");
    parts[1] = "A".repeat(22);
    expect(() => decryptMetaToken(parts.join("."))).toThrow(/Reconnect/);
  });
  it("retains old auth-key ciphertext while introducing a dedicated key", () => {
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("META_TOKEN_ENCRYPTION_KEY", "");
    const old = encryptMetaToken("original");
    vi.stubEnv("META_TOKEN_ENCRYPTION_KEY", "b".repeat(48));
    expect(decryptMetaToken(old)).toBe("original");
    expect(decryptMetaToken(encryptMetaToken("new"))).toBe("new");
  });
  it("allows legacy reads for upgrade but fails closed for new storage without a key", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NEXTAUTH_SECRET", "");
    vi.stubEnv("META_TOKEN_ENCRYPTION_KEY", "");
    expect(decryptMetaToken("legacy-token")).toBe("legacy-token");
    expect(() => encryptMetaToken("token")).toThrow(/not configured/);
  });
});
