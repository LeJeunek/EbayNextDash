// Demo mode switch and cookie settings.
import { describe, expect, it } from "vitest";
import {
  DEMO_COOKIE,
  DEMO_READ_ONLY_MESSAGE,
  DEMO_SYNC_NOTICE,
  demoCookieOptions,
  isDemoEnabled,
} from "@/lib/demo/config";

describe("isDemoEnabled", () => {
  it("is on by default, so the shareable /demo link works without setup", () => {
    expect(isDemoEnabled({})).toBe(true);
  });

  it.each(["off", "OFF", "false", "0", "disabled"])(
    "is off when DEMO_MODE=%s",
    (value) => {
      expect(isDemoEnabled({ DEMO_MODE: value })).toBe(false);
    }
  );

  it("stays on for any other value", () => {
    expect(isDemoEnabled({ DEMO_MODE: "on" })).toBe(true);
  });
});

describe("demo cookie", () => {
  it("has a stable name", () => {
    expect(DEMO_COOKIE).toBe("resold_demo");
  });

  it("is httpOnly, lax, site-wide and expires after 4 hours", () => {
    expect(demoCookieOptions).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 4 * 60 * 60,
    });
  });
});

describe("demo messages", () => {
  it("tells the visitor why a change was refused", () => {
    expect(DEMO_READ_ONLY_MESSAGE).toMatch(/demo/i);
    expect(DEMO_READ_ONLY_MESSAGE).toMatch(/sign in/i);
  });

  it("says plainly that sync made no eBay calls", () => {
    expect(DEMO_SYNC_NOTICE).toMatch(/no eBay/i);
  });
});
