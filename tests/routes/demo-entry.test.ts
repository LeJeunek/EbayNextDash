// The shareable /demo link and its exit.
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as enter } from "@/app/demo/route";
import { GET as exit } from "@/app/demo/exit/route";

afterEach(() => vi.unstubAllEnvs());

const req = (path: string) => new NextRequest(`https://resold.example${path}`);

describe("GET /demo", () => {
  it("sets the demo cookie and opens the dashboard", async () => {
    const res = await enter(req("/demo"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/resold_demo=1/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=14400/);
  });

  it("sends visitors to sign-in, with no cookie, when demo mode is off", async () => {
    vi.stubEnv("DEMO_MODE", "off");
    const res = await enter(req("/demo"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("GET /demo/exit", () => {
  it("clears the cookie and returns to sign-in", async () => {
    const res = await exit(req("/demo/exit"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/resold_demo=;/);
    expect(cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });
});
