// src/lib/ebay-token.ts
import { prisma } from "./prisma";
import {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_SCOPES,
  EBAY_TOKEN_URL,
  readJson,
} from "./auth";

/** Refresh slightly early so a token can't lapse between here and eBay. */
const EXPIRY_MARGIN_SECONDS = 60;

/** The stored eBay credentials can't be used or renewed; the user must sign in again. */
export class EbayReauthRequired extends Error {
  constructor(reason: string) {
    super(
      `eBay connection expired (${reason}). Sign out and sign in again to reconnect eBay.`
    );
    this.name = "EbayReauthRequired";
  }
}

/**
 * A live eBay user access token for this user, refreshed if needed.
 *
 * eBay access tokens last 2 hours; the refresh token that comes with them lasts
 * about 18 months. The app used to read the access token saved at sign-in and
 * never renew it, so every eBay call failed with "Invalid access token" two
 * hours after signing in. This renews it with the refresh grant and stores the
 * result, so the next call reuses it until it too nears expiry.
 */
export async function getEbayAccessToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "ebay" },
    orderBy: { id: "desc" },
  });
  if (!account?.access_token) {
    throw new EbayReauthRequired("no eBay account is linked");
  }

  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at - EXPIRY_MARGIN_SECONDS > now) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new EbayReauthRequired("no refresh token is stored");
  }

  const response = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    // eBay requires the scopes again on refresh, equal to or a subset of the
    // ones originally granted.
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
      scope: EBAY_SCOPES,
    }),
  });

  const tokens = await readJson(response, "eBay token refresh", {
    logBody: false,
  });

  if (!response.ok || !tokens.access_token) {
    // A refresh token from another keyset (e.g. a sandbox sign-in, now that the
    // app points at production) or one eBay has revoked lands here.
    console.error(
      `[auth] eBay token refresh failed (${response.status}):`,
      tokens.error,
      tokens.error_description
    );
    throw new EbayReauthRequired(
      tokens.error_description || `token refresh returned ${response.status}`
    );
  }

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: tokens.access_token,
      expires_at: now + Number(tokens.expires_in || 7200),
      // eBay normally keeps the same refresh token; store a new one if it sends one.
      ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
    },
  });

  return tokens.access_token;
}
