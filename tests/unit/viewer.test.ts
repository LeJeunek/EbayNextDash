// Who is looking at the page: a signed-in eBay user, the demo, or nobody.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerSession, cookieJar } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  cookieJar: new Map<string, string>(),
}));

vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
  }),
}));

import { getViewer } from "@/lib/viewer";
import { DEMO_USER } from "@/lib/demo/fixtures";

const realSession = {
  user: { id: "user_1", name: "Real Seller", email: "r@x.test", ebayUsername: "real_seller" },
};

beforeEach(() => {
  getServerSession.mockReset();
  cookieJar.clear();
  vi.unstubAllEnvs();
});

describe("getViewer", () => {
  it("returns the signed-in user", async () => {
    getServerSession.mockResolvedValue(realSession);
    expect(await getViewer()).toEqual({
      kind: "user",
      userId: "user_1",
      user: realSession.user,
    });
  });

  it("prefers a real session over a leftover demo cookie", async () => {
    getServerSession.mockResolvedValue(realSession);
    cookieJar.set("resold_demo", "1");
    expect((await getViewer())?.kind).toBe("user");
  });

  it("returns the demo viewer when only the demo cookie is present", async () => {
    getServerSession.mockResolvedValue(null);
    cookieJar.set("resold_demo", "1");
    const viewer = await getViewer();
    expect(viewer).toEqual({ kind: "demo", user: DEMO_USER });
    // A demo viewer must not carry a userId: no code path can query real rows with it.
    expect(viewer).not.toHaveProperty("userId");
  });

  it("ignores the demo cookie when demo mode is switched off", async () => {
    vi.stubEnv("DEMO_MODE", "off");
    getServerSession.mockResolvedValue(null);
    cookieJar.set("resold_demo", "1");
    expect(await getViewer()).toBeNull();
  });

  it("ignores a demo cookie with an unexpected value", async () => {
    getServerSession.mockResolvedValue(null);
    cookieJar.set("resold_demo", "yes-please");
    expect(await getViewer()).toBeNull();
  });

  it("returns null for anonymous visitors", async () => {
    getServerSession.mockResolvedValue(null);
    expect(await getViewer()).toBeNull();
  });
});
