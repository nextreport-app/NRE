import { NextResponse } from "next/server";

/**
 * Builds a logged, diagnosable 500 response for an unhandled route error —
 * most commonly a DB connectivity failure (bad DATABASE_URL, missing SSL,
 * wrong Supabase pooler mode). `context` is logged server-side (visible in
 * Vercel's function logs) to identify which route failed. Without this,
 * these errors crash the function silently and the client only ever sees a
 * generic "something went wrong" with no way to diagnose the real cause.
 */
export function apiErrorResponse(err: unknown, context: string): NextResponse {
  console.error(`[api:${context}] failed:`, err);
  const message = err instanceof Error ? err.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}
