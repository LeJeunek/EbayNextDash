// src/lib/demo/config.ts
//
// Demo mode lets anyone explore Resold with sample data, from a shareable
// /demo link, without an eBay account. It is built so a demo visitor can never
// cause an eBay API call or a database query: every demo screen is rendered
// from in-memory fixtures (./fixtures.ts), sync is simulated, and writes are
// refused. That holds however hard the buttons are clicked.

/** Cookie that marks a browser as being in demo mode. */
export const DEMO_COOKIE = "resold_demo";

/** The only value the cookie is accepted with. */
export const DEMO_COOKIE_VALUE = "1";

export const demoCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 4 * 60 * 60, // 4 hours
  secure: process.env.NODE_ENV === "production",
};

/**
 * Demo mode is on unless DEMO_MODE says otherwise, so the /demo link works on
 * a fresh deploy. Set DEMO_MODE=off to disable it entirely.
 */
export function isDemoEnabled(env: Record<string, string | undefined> = process.env) {
  const value = env.DEMO_MODE?.trim().toLowerCase();
  return !(value && ["off", "false", "0", "disabled"].includes(value));
}

export const DEMO_READ_ONLY_MESSAGE =
  "This is a demo with sample data, so changes aren't saved. Sign in with eBay to use your own account.";

export const DEMO_SYNC_NOTICE =
  "Demo mode: sync is simulated with sample data. No eBay API calls were made.";
