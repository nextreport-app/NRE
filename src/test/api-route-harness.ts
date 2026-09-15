import type { Session } from "next-auth";

/** Parse a route handler JSON response in tests. */
export async function jsonBody<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

/** Next.js 15 route context helper for dynamic segments. */
export function routeParams<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

export function mockSession(userId: string, email = "test@example.com"): Session {
  return {
    user: { id: userId, email, name: "Test User" },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

/** Active trial user row shape used by subscription guards. */
export function mockTrialUser(overrides: Record<string, unknown> = {}) {
  return {
    email: "trial@example.com",
    planId: "trial",
    trialEndsAt: new Date(Date.now() + 7 * 86_400_000),
    ...overrides,
  };
}
