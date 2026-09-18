import { NextResponse } from "next/server";

/** PDF export was removed — return 410 for any bookmarked or cached links. */
export async function GET() {
  return NextResponse.json({ error: "PDF download is no longer available." }, { status: 410 });
}
