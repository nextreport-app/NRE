import { afterEach, describe, expect, it, vi } from "vitest";
import { isGoogleSignInEnabled } from "../google-sign-in-enabled";

describe("isGoogleSignInEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays enabled with empty or stale disabled environment settings", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED", "");
    expect(isGoogleSignInEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED", "false");
    expect(isGoogleSignInEnabled()).toBe(true);
  });

  it("remains enabled with the previous enabled environment setting", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED", "true");
    expect(isGoogleSignInEnabled()).toBe(true);
  });
});
