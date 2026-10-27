import { takeRateLimit, requestAddress } from "./usage-rate-limit";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import authConfig from "@/lib/auth.config";
import { notifyAdminNewSignup } from "@/lib/admin-signup-notification";
import { sendWelcomeTrialEmail } from "@/lib/billing-user-emails";
import { GOOGLE_LOGIN_AUTHORIZATION_PARAMS } from "@/lib/auth-google-sign-in";
import { isGoogleSignInEnabled } from "@/lib/google-sign-in-enabled";
import { normalizeAuthEmail } from "@/lib/normalize-auth-email";
import { findUserByEmail } from "@/lib/find-user-by-email";
import { OAuthOnlyAccountSignin } from "@/lib/auth-oauth-only-signin";

const googleProvider = Google({
  checks: ["pkce", "state"],
  clientId: process.env.AUTH_GOOGLE_ID,
  clientSecret: process.env.AUTH_GOOGLE_SECRET,
  // Same email may exist from email/password signup — link Google instead of OAuthAccountNotLinked.
  allowDangerousEmailAccountLinking: true,
  authorization: { params: { ...GOOGLE_LOGIN_AUTHORIZATION_PARAMS } },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    ...(isGoogleSignInEnabled() ? [googleProvider] : []),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const emailRaw = credentials?.email;
        const password = credentials?.password;
        if (typeof emailRaw !== "string" || typeof password !== "string") return null;

        const email = normalizeAuthEmail(emailRaw);
        if (!email || !password || password.length > 1024) return null;

        try {
          if (!(await takeRateLimit("login-email", email, 10, 900)) || !(await takeRateLimit("login-ip", requestAddress(request), 50, 900))) return null;
          const user = await findUserByEmail(emailRaw, {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
          });
          if (!user) return null;
          if (!user.passwordHash) {
            throw new OAuthOnlyAccountSignin();
          }

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;

          return { id: user.id, email: user.email, name: user.name, image: user.image };
        } catch (err) {
          if (err instanceof OAuthOnlyAccountSignin) throw err;
          console.error("[auth:credentials] authorize failed:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      return account?.provider !== "google" || (profile as { email_verified?: boolean } | undefined)?.email_verified === true;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      if (typeof token.id !== "string") return null;
      const current = await prisma.user.findUnique({ where: { id: token.id }, select: { authVersion: true } });
      if (!current) return null;
      if (user) token.authVersion = current.authVersion;
      else if ((token.authVersion ?? 0) !== current.authVersion) return null;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      notifyAdminNewSignup({
        email: user.email ?? "unknown",
        name: user.name,
        provider: "google",
      });
      if (user.id && user.email) {
        const row = await prisma.user.findUnique({
          where: { id: user.id },
          select: { email: true, name: true, trialEndsAt: true },
        });
        if (row) {
          sendWelcomeTrialEmail({ to: row.email, name: row.name, trialEndsAt: row.trialEndsAt });
        }
      }
    },
    // The adapter only calls `linkAccount` (which persists tokens) the first
    // time an OAuth account is linked — on every subsequent "Continue with
    // Google" it just signs the user in without touching the stored tokens.
    // Upserting the tokens here, using the fresh values Auth.js always
    // passes to this event regardless of whether linkAccount ran, keeps the
    // Account row current every time.
    async signIn({ user, account }) {
      if (!account || account.provider !== "google" || !user.id) return;
      await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
      const tokens = {
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
        token_type: account.token_type,
        scope: account.scope,
        id_token: account.id_token,
      };
      await prisma.account.upsert({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        create: {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          type: account.type,
          userId: user.id,
          ...tokens,
        },
        update: tokens,
      });
    },
  },
});
