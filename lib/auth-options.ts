import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";
import { demoMode } from "./policy";
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    ...(process.env.ENTRA_CLIENT_ID && !demoMode()
      ? [
          AzureADProvider({
            clientId: process.env.ENTRA_CLIENT_ID,
            clientSecret: process.env.ENTRA_CLIENT_SECRET!,
            tenantId: process.env.ENTRA_TENANT_ID!,
            authorization: { params: { scope: "openid profile email" } },
          }),
        ]
      : []),
    ...(demoMode() && process.env.DEMO_LOGIN_ENABLED === "true"
      ? [
          CredentialsProvider({
            id: "demo",
            name: "Demonstração local",
            credentials: { email: { type: "text" } },
            async authorize(credentials) {
              if (!demoMode() || process.env.DEMO_LOGIN_ENABLED !== "true")
                return null;
              const user = await db.user.findUnique({
                where: { email: credentials?.email ?? "" },
              });
              if (!user?.active || !user.isDemo) return null;
              return { id: user.id, name: user.name, email: user.email };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "demo") return demoMode();
      if (demoMode() || account?.provider !== "azure-ad") return false;
      const aad = profile as {
        tid?: string;
        preferred_username?: string;
        email?: string;
      };
      if (aad.tid !== process.env.ENTRA_TENANT_ID) return false;
      const email = (aad.preferred_username ?? aad.email ?? "").toLowerCase();
      const allowed = [
        process.env.LUCIANO_EMAIL,
        process.env.RAFAEL_EMAIL,
        process.env.GUSTAVO_EMAIL,
      ]
        .filter(Boolean)
        .map((e) => e!.toLowerCase());
      if (!allowed.includes(email)) return false;
      const local = await db.user.findUnique({ where: { email } });
      if (!local?.active || local.isDemo) return false;
      user.id = local.id;
      user.email = local.email;
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.sub;
      return session;
    },
  },
};
