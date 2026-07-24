import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import authConfig from "@/lib/auth.config";
import { GOOGLE_DRIVE_SCOPE } from "@/lib/google-drive";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          // access_type=offline + prompt=consent guarantee a refresh_token on
          // every explicit "Continue with Google" click (Google otherwise
          // only issues one on a user's very first consent), since we need a
          // long-lived refresh token to call the Drive API later, outside the
          // login request itself, for the "Get Google Slides Link" feature.
          scope: `openid email profile ${GOOGLE_DRIVE_SCOPE}`,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
  events: {
    // The adapter only calls `linkAccount` (which persists tokens) the first
    // time an OAuth account is linked — on every subsequent "Continue with
    // Google" it just signs the user in without touching the stored tokens.
    // That means a returning user re-consenting to grant the new Drive scope
    // would have their fresh refresh_token silently discarded. Upserting the
    // tokens here, using the fresh values Auth.js always passes to this
    // event regardless of whether linkAccount ran, keeps the Account row
    // current every time.
    async signIn({ user, account }) {
      if (!account || account.provider !== "google" || !user.id) return;
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
