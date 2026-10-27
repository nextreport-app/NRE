import { NextResponse } from "next/server";
import { ServiceError } from "./service-error";
import { CsvInputError } from "./nre/parse-csv";

/**
 * Builds a logged, diagnosable 500 response for an unhandled route error —
 * most commonly a DB connectivity failure (bad DATABASE_URL, missing SSL,
 * wrong Supabase pooler mode). `context` is logged server-side (visible in
 * Vercel's function logs) to identify which route failed. Without this,
 * these errors crash the function silently and the client only ever sees a
 * generic "something went wrong" with no way to diagnose the real cause.
 */
export function apiErrorResponse(err: unknown, context: string): NextResponse {
  if (err instanceof ServiceError) return NextResponse.json({ error: err.message }, { status: err.status, headers: err.retryAfter ? { "Retry-After": String(err.retryAfter) } : undefined });
  if (err instanceof CsvInputError) return NextResponse.json({ valid: false, error: err.message, errors: [{ field: "csv", message: err.message }], warnings: [] }, { status: 400 });
  console.error(`[api:${context}] failed:`, err);
  const message = "Something went wrong. Please try again or contact support.";
  return NextResponse.json({ error: message }, { status: 500 });
}
