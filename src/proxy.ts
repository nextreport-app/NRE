import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/lib/auth.config";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/privacy",
  "/terms",
  "/contact",
  "/about",
  "/pricing",
  "/help/download",
  // Internal design preview, not linked from anywhere — accessible directly
  // by URL without logging in, same as the other public marketing pages.
  "/light-preview",
];

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/api/auth") ||
    // Razorpay calls this server-to-server with no NextAuth session — it
    // authenticates itself via its own HMAC webhook signature instead (see
    // api/payments/webhook/route.ts), not a session cookie. A session-based
    // 401/redirect here would make every real webhook delivery fail before
    // that check even runs.
    pathname === "/api/payments/webhook" ||
    // The waitlist is filled out by anonymous visitors on the public
    // /pricing page (see components/waitlist-form.tsx) — there's no
    // session to require here, same as /pricing itself being public.
    pathname === "/api/waitlist";

  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/clients", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
