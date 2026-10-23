import { afterEach, describe, expect, it, vi } from "vitest";
import { isGoogleSignInEnabled } from "../google-sign-in-enabled";

describe("isGoogleSignInEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when unset or not true", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED", "");
    expect(isGoogleSignInEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED", "false");
    expect(isGoogleSignInEnabled()).toBe(false);
  });

  it("is true only when env is exactly true", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED", "true");
    expect(isGoogleSignInEnabled()).toBe(true);
  });
});
