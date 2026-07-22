import type { NextAuthConfig } from "next-auth";

// Edge-safe config: no Prisma adapter, no DB-touching authorize() here.
// Used directly by middleware; extended with the adapter + providers in auth.ts
// for route handlers, which run in the Node.js runtime.
export default {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
