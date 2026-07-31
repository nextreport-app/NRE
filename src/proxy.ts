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
    // No longer linked from /pricing (Razorpay now handles USD checkout
    // directly there too — see components/subscribe-button.tsx), but the
    // route itself is left in place rather than removed outright; still
    // public/no-auth since anonymous visitors are what it was ever for.
    pathname === "/api/waitlist" ||
    // The /contact form (public page) is filled out by anonymous visitors
    // too — same reasoning as /api/waitlist above.
    pathname === "/api/contact";

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
