import { randomBytes } from "crypto";

// Unambiguous alphanumeric charset for the public share link — no lookalike
// characters excluded on purpose (the token is never hand-typed by a human,
// only copy-pasted, so readability doesn't matter; keeping the full 62-char
// alphabet maximizes the 62^12 guess space the security review asked for).
const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const TOKEN_LENGTH = 12;

/**
 * A 12-character unguessable token for the public read-only share page
 * (/r/[token]) — 62^12 (~3.2×10^21) possible combinations, generated from
 * crypto.randomBytes rather than Math.random() so it's not predictable.
 * Uses rejection sampling (discarding out-of-range bytes) instead of a
 * modulo reduction so every character of CHARSET has exactly equal
 * probability — a plain `byte % 62` would slightly favor the first 4
 * characters (256 isn't a multiple of 62).
 */
export function generateShareToken(): string {
  let token = "";
  while (token.length < TOKEN_LENGTH) {
    const bytes = randomBytes(TOKEN_LENGTH - token.length);
    for (const byte of bytes) {
      if (byte < 248) {
        // 248 = 4 * 62, the largest multiple of 62 that fits in a byte.
        token += CHARSET[byte % 62];
        if (token.length === TOKEN_LENGTH) break;
      }
    }
  }
  return token;
}
