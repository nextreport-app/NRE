import { describe, expect, it } from "vitest";
import {
  buildOnboardingSteps,
  hasAnyPlatformConnection,
  onboardingProgress,
  shouldShowOnboarding,
  type OnboardingStateInput,
} from "@/lib/onboarding";

const baseInput: OnboardingStateInput = {
  dismissedAt: null,
  clientCount: 0,
  firstClientId: null,
  hasPlatformConnection: false,
  completeReportCount: 0,
};

describe("buildOnboardingSteps", () => {
  it("links new users to client creation", () => {
    const steps = buildOnboardingSteps(baseInput);
    expect(steps).toHaveLength(3);
    expect(steps[0]!.href).toBe("/clients/new");
    expect(steps[2]!.href).toBe("/clients/new");
    expect(steps[1]!.optional).toBe(true);
  });

  it("marks steps done from account activity", () => {
    const steps = buildOnboardingSteps({
      ...baseInput,
      clientCount: 2,
      firstClientId: "client_abc",
      hasPlatformConnection: true,
      completeReportCount: 1,
    });

    expect(steps[0]!.done).toBe(true);
    expect(steps[0]!.href).toBe("/clients/client_abc");
    expect(steps[1]!.done).toBe(true);
    expect(steps[2]!.done).toBe(true);
    expect(steps[2]!.href).toBe("/clients/client_abc/reports/new");
  });
});

describe("shouldShowOnboarding", () => {
  it("hides when dismissed", () => {
    expect(shouldShowOnboarding({ ...baseInput, dismissedAt: new Date() })).toBe(false);
  });

  it("shows until required steps are complete", () => {
    expect(shouldShowOnboarding(baseInput)).toBe(true);
    expect(
      shouldShowOnboarding({
        ...baseInput,
        clientCount: 1,
        firstClientId: "c1",
      }),
    ).toBe(true);
    expect(
      shouldShowOnboarding({
        ...baseInput,
        clientCount: 1,
        firstClientId: "c1",
        completeReportCount: 1,
      }),
    ).toBe(false);
  });

  it("does not require the optional connect step", () => {
    expect(
      shouldShowOnboarding({
        ...baseInput,
        clientCount: 1,
        firstClientId: "c1",
        completeReportCount: 1,
        hasPlatformConnection: false,
      }),
    ).toBe(false);
  });
});

describe("onboardingProgress", () => {
  it("counts only required steps", () => {
    const steps = buildOnboardingSteps({
      ...baseInput,
      clientCount: 1,
      firstClientId: "c1",
      hasPlatformConnection: true,
    });
    expect(onboardingProgress(steps)).toEqual({ completed: 1, total: 2 });
  });
});

describe("hasAnyPlatformConnection", () => {
  it("detects any connected ad platform", () => {
    expect(hasAnyPlatformConnection({})).toBe(false);
    expect(hasAnyPlatformConnection({ metaConnectedUserId: "123" })).toBe(true);
    expect(hasAnyPlatformConnection({ googleAdsEnabled: true })).toBe(true);
    expect(hasAnyPlatformConnection({ ga4RefreshToken: "token" })).toBe(true);
    expect(hasAnyPlatformConnection({ tiktokAdsEnabled: true })).toBe(true);
  });
});
