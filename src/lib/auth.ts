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

/**
 * Read a credential from the environment, trimming surrounding whitespace.
 *
 * A trailing newline is easy to pick up when pasting into a hosting
 * dashboard and impossible to see afterwards. It matters here because the
 * value goes into an HTTP Basic header and into form bodies, where eBay
 * rejects it as "client authentication failed" — an error that points at the
 * credential being wrong rather than merely padded.
 */
function credential(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed !== raw) {
    console.warn(
      `[auth] ${name} had surrounding whitespace; trimmed. ` +
        `Re-enter it without a trailing newline to silence this.`
    );
  }
  return trimmed || undefined;
}

const EBAY_CLIENT_ID = credential("EBAY_CLIENT_ID");
const EBAY_CLIENT_SECRET = credential("EBAY_CLIENT_SECRET");
const EBAY_RUNAME = credential("EBAY_RUNAME");

// Without a RuName the authorize params carry redirect_uri: undefined, which
// openid-client strips — producing the same opaque eBay 400 as sending a URL.
// Say so in the logs rather than leaving it to be rediscovered.
if (!EBAY_RUNAME) {
  console.error(
    "[auth] EBAY_RUNAME is not set. eBay OAuth requires the RuName from your " +
      "developer portal as redirect_uri in BOTH the authorize and token steps; " +
      "sign-in will fail with a 400 until it is configured."
  );
}


// Presence and length only — never the values. Enough to spot a variable that
// did not reach the runtime, or one that is obviously the wrong field.
console.info(
  "[auth] eBay credentials:",
  JSON.stringify({
    EBAY_CLIENT_ID: EBAY_CLIENT_ID
      ? { set: true, length: EBAY_CLIENT_ID.length, env: EBAY_CLIENT_ID.includes("-SBX-") ? "SBX" : EBAY_CLIENT_ID.includes("-PRD-") ? "PRD" : "unknown" }
      : { set: false },
    EBAY_CLIENT_SECRET: EBAY_CLIENT_SECRET
      ? { set: true, length: EBAY_CLIENT_SECRET.length, env: EBAY_CLIENT_SECRET.startsWith("SBX-") ? "SBX" : EBAY_CLIENT_SECRET.startsWith("PRD-") ? "PRD" : "unknown" }
      : { set: false },
    EBAY_RUNAME: EBAY_RUNAME ? { set: true, length: EBAY_RUNAME.length } : { set: false },
    EBAY_TOKEN_URL,
  })
);

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
          redirect_uri: EBAY_RUNAME,
        },
      },
      token: {
        url: EBAY_TOKEN_URL,
        async request({ params }) {
          const credentials = Buffer.from(
            `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
          ).toString("base64");

          const body = new URLSearchParams({
            grant_type: "authorization_code",
            code: params.code as string,
            // eBay token exchange requires the RuName as redirect_uri, NOT the actual URL
            redirect_uri: EBAY_RUNAME!,
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

          if (!response.ok) {
            console.error(
              `[auth] eBay identity lookup failed (${response.status}):`,
              JSON.stringify(profile)
            );
            throw new Error(
              `eBay identity lookup failed (${response.status}). The usual ` +
                `cause is commerce.identity.readonly not being enabled for ` +
                `this keyset under Auth Accepted Scopes.`
            );
          }

          // A 200 with neither field means the shape changed; failing here
          // beats handing NextAuth a user with id: undefined.
          if (!profile?.userId && !profile?.username) {
            console.error(
              "[auth] eBay identity returned no userId or username:",
              JSON.stringify(profile)
            );
            throw new Error(
              "eBay identity response contained no userId or username."
            );
          }

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
      clientId: EBAY_CLIENT_ID,
      clientSecret: EBAY_CLIENT_SECRET,
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
      // NextAuth runs this callback BEFORE the adapter creates the user on a
      // first sign-in: `getUserByAccount` finds nothing, so `user` is still
      // the OAuth profile and `user.id` is eBay's user ID, not a row in our
      // table. `update` would throw P2025, which NextAuth turns into a
      // redirect back to /login — sign-in could never succeed for a new user.
      //
      // New users get these fields from profile() below, which the adapter
      // passes straight to createUser. So this only has to refresh rows that
      // already exist, and updateMany is a no-op (count 0) when none does.
      if (account?.provider === "ebay" && profile) {
        const p = profile as any;
        await prisma.user.updateMany({
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