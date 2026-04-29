// src/lib/auth.ts
import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";

const EBAY_AUTH_URL =
  process.env.EBAY_AUTH_URL ||
  "https://auth.sandbox.ebay.com/oauth2/authorize";
const EBAY_TOKEN_URL =
  process.env.EBAY_TOKEN_URL ||
  "https://api.sandbox.ebay.com/identity/v1/oauth2/token";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    {
      id: "ebay",
      name: "eBay",
      type: "oauth",
      authorization: {
        url: EBAY_AUTH_URL,
        params: {
          scope:
            "https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.fulfillment https://api.ebay.com/oauth/api_scope/sell.account",
          response_type: "code",
        },
      },
      token: {
        url: EBAY_TOKEN_URL,
        async request({ client, params, checks, provider }) {
          const credentials = Buffer.from(
            `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
          ).toString("base64");

          const response = await fetch(EBAY_TOKEN_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${credentials}`,
            },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code: params.code as string,
              redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/ebay`,
            }),
          });

          const tokens = await response.json();
          return { tokens };
        },
      },
      userinfo: {
        async request({ tokens }) {
          const apiBase =
            process.env.EBAY_API_BASE || "https://api.sandbox.ebay.com";
          const response = await fetch(
            `${apiBase}/commerce/identity/v1/user/`,
            {
              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                "Content-Type": "application/json",
              },
            }
          );
          const profile = await response.json();
          return profile;
        },
      },
      profile(profile) {
        return {
          id: profile.userId || profile.username,
          name:
            profile.individualAccount?.name?.firstName &&
            profile.individualAccount?.name?.lastName
              ? `${profile.individualAccount.name.firstName} ${profile.individualAccount.name.lastName}`
              : profile.username,
          email:
            profile.email ||
            `${profile.username}@ebay-user.placeholder`,
          image: null,
          ebayUserId: profile.userId,
          ebayUsername: profile.username,
        };
      },
      clientId: process.env.EBAY_CLIENT_ID,
      clientSecret: process.env.EBAY_CLIENT_SECRET,
    },
  ],
  session: {
    strategy: "database",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // Fetch the latest account tokens for API calls
        const account = await prisma.account.findFirst({
          where: { userId: user.id, provider: "ebay" },
          orderBy: { id: "desc" },
        });
        if (account) {
          session.accessToken = account.access_token as string;
          session.refreshToken = account.refresh_token as string;
        }
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { ebayUsername: true, ebayUserId: true },
        });
        if (dbUser) {
          session.user.ebayUsername = dbUser.ebayUsername ?? undefined;
          session.user.ebayUserId = dbUser.ebayUserId ?? undefined;
        }
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Update eBay-specific fields on sign in
      if (account?.provider === "ebay" && profile) {
        const p = profile as any;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            ebayUserId: p.userId || null,
            ebayUsername: p.username || null,
          },
        });
      }
      return true;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
