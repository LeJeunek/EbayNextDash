// The public demo MCP endpoint at /api/mcp.
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/mcp/route";
import { readFileSync } from "node:fs";

afterEach(() => vi.unstubAllEnvs());

function mcpRequest(body: unknown) {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
}
const toolsList = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };

describe("POST /api/mcp", () => {
  it("lists the three demo tools", async () => {
    const res = await POST(mcpRequest(toolsList));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("list_inventory");
    expect(text).toContain("sales_summary");
    expect(text).toContain("list_orders");
  });

  it("returns 404 when demo mode is off", async () => {
    vi.stubEnv("DEMO_MODE", "off");
    // send the same request
    const res = await POST(mcpRequest(toolsList));
    // expect the status to be 404
    expect(res.status).toBe(404);
  });

  it("rejects oversized requests", async () => {
    // send the tools message with a huge filler inside params:
    const res = await POST(
      mcpRequest({ ...toolsList, params: { pad: "x".repeat(100_000) } }),
    );
    // expect the status to be 413
    expect(res.status).toBe(413);
  });
});

describe("demo MCP code", () => {
  it("never imports real-data code", () => {
    // TODO: a list of the three files to check:
    //   "src/lib/mcp/server.ts"
    //   "src/lib/mcp/demo-tools.ts"
    //   "src/app/api/mcp/route.ts"
    const filesToCheck = [
      "src/lib/mcp/server.ts",
      "src/lib/mcp/demo-tools.ts",
      "src/app/api/mcp/route.ts",
    ];

    for (const file of filesToCheck) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(
        /from\s+["'](@prisma\/client|@\/lib\/(prisma|viewer|ebay|ebay-token|auth))["']/,
      );
    }

    // TODO: loop over the list. For each file:
    //   read it:   readFileSync(<file>, "utf8")
    //   expect it not to match:
    //   /from\s+["'](@prisma\/client|@\/lib\/(prisma|viewer|ebay|ebay-token|auth))["']/
  });
});
