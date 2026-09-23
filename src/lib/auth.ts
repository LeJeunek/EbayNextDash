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

// Only the scopes this app actually calls. eBay rejects the whole
// authorize request with a 400 if ANY requested scope is not enabled for
// your app in the developer portal, and several scopes (commerce.vero,
// sell.payment.dispute, commerce.message, sell.stores) need separate
// approval — so asking for everything is a reliable way to get locked out.
//
//   api_scope                  base, required
//   sell.inventory             /sell/inventory/v1/... (read + write)
//   sell.fulfillment.readonly  /sell/fulfillment/v1/order (read only)
//   sell.account.readonly      /sell/account/v1/privilege
//   commerce.identity.readonly /commerce/identity/v1/user (username)
//
// Note these are always api.ebay.com URLs, even against sandbox.
// Override with EBAY_SCOPES (space-separated) if your app needs more.
const DEFAULT_EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
].join(" ");

const EBAY_SCOPES = process.env.EBAY_SCOPES || DEFAULT_EBAY_SCOPES;

// Without a RuName the authorize params carry redirect_uri: undefined, which
// openid-client strips — producing the same opaque eBay 400 as sending a URL.
// Say so in the logs rather than leaving it to be rediscovered.
if (!process.env.EBAY_RUNAME) {
  console.error(
    "[auth] EBAY_RUNAME is not set. eBay OAuth requires the RuName from your " +
      "developer portal as redirect_uri in BOTH the authorize and token steps; " +
      "sign-in will fail with a 400 until it is configured."
  );
}

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
          scope: EBAY_SCOPES,
          response_type: "code",
          // eBay wants the RuName here, not a URL — the same rule the token
          // exchange below already follows. Without this, NextAuth fills in
          // `${NEXTAUTH_URL}/api/auth/callback/ebay` and eBay rejects the
          // authorize request outright with
          // {"error_id":"invalid_request","http_status_code":400}.
          // openid-client spreads these params over its own defaults, so
          // this value wins.
          redirect_uri: process.env.EBAY_RUNAME,
        },
      },
      token: {
        url: EBAY_TOKEN_URL,
        async request({ params }) {
          const credentials = Buffer.from(
            `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
          ).toString("base64");

          const body = new URLSearchParams({
            grant_type: "authorization_code",
            code: params.code as string,
            // eBay token exchange requires the RuName as redirect_uri, NOT the actual URL
            redirect_uri: process.env.EBAY_RUNAME!,
          });

          const response = await fetch(EBAY_TOKEN_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${credentials}`,
            },
            body,
          });

          const tokens = await response.json();

          if (!response.ok) {
            console.error("eBay token exchange failed:", tokens);
            throw new Error(tokens.error_description || "Token exchange failed");
          }

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