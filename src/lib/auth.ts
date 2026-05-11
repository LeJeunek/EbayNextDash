// src/lib/auth.ts
import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";

const EBAY_AUTH_URL =
  process.env.EBAY_AUTH_URL || "https://auth.sandbox.ebay.com/oauth2/authorize";
const EBAY_TOKEN_URL =
  process.env.EBAY_TOKEN_URL ||
  "https://api.sandbox.ebay.com/identity/v1/oauth2/token";

// Scopes must match exactly what is registered in the eBay Developer Portal
// Copy from: developer.ebay.com/my/keys -> User Tokens -> your RuName -> OAuth URL -> scope param
const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/buy.order.readonly",
  "https://api.ebay.com/oauth/api_scope/buy.guest.order",
  "https://api.ebay.com/oauth/api_scope/sell.marketing.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.marketing",
  "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.analytics.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.marketplace.insights.readonly",
  "https://api.ebay.com/oauth/api_scope/commerce.catalog.readonly",
  "https://api.ebay.com/oauth/api_scope/buy.shopping.cart",
  "https://api.ebay.com/oauth/api_scope/buy.offer.auction",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.email.readonly",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.phone.readonly",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.address.readonly",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.name.readonly",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.status.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.finances",
  "https://api.ebay.com/oauth/api_scope/sell.payment.dispute",
  "https://api.ebay.com/oauth/api_scope/sell.item.draft",
  "https://api.ebay.com/oauth/api_scope/sell.item",
  "https://api.ebay.com/oauth/api_scope/sell.reputation",
  "https://api.ebay.com/oauth/api_scope/sell.reputation.readonly",
  "https://api.ebay.com/oauth/api_scope/commerce.notification.subscription",
  "https://api.ebay.com/oauth/api_scope/commerce.notification.subscription.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.stores",
  "https://api.ebay.com/oauth/api_scope/sell.stores.readonly",
  "https://api.ebay.com/oauth/api_scope/commerce.vero",
  "https://api.ebay.com/oauth/api_scope/sell.inventory.mapping",
  "https://api.ebay.com/oauth/api_scope/commerce.message",
  "https://api.ebay.com/oauth/api_scope/commerce.feedback",
  "https://api.ebay.com/oauth/api_scope/commerce.shipping",
].join(" ");

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
          // Must match the RuName registered in eBay developer portal
          redirect_uri: process.env.EBAY_RUNAME,
        },
      },
      token: {
        url: EBAY_TOKEN_URL,
        async request({ params }) {
          const credentials = Buffer.from(
            `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`,
          ).toString("base64");

          const body = new URLSearchParams({
            grant_type: "authorization_code",
            code: params.code as string,
            redirect_uri: process.env.EBAY_RUNAME!,
          });

          // DEBUG LOGGING
          console.log("=== EBAY TOKEN EXCHANGE DEBUG ===");
          console.log("RUNAME:", process.env.EBAY_RUNAME);
          console.log("CLIENT_ID:", process.env.EBAY_CLIENT_ID);
          console.log(
            "CLIENT_SECRET length:",
            process.env.EBAY_CLIENT_SECRET?.length,
          );
          console.log("CODE (first 20 chars):", params.code?.slice(0, 20));
          console.log("BODY:", body.toString());

          const response = await fetch(EBAY_TOKEN_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${credentials}`,
            },
            body,
          });

          const tokens = await response.json();
          console.log("EBAY RESPONSE STATUS:", response.status);
          console.log("EBAY RESPONSE:", JSON.stringify(tokens));

          if (!response.ok) {
            console.error("eBay token exchange failed:", tokens);
            throw new Error(
              tokens.error_description || "Token exchange failed",
            );
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
            },
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
          email: profile.email || `${profile.username}@ebay-user.placeholder`,
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
