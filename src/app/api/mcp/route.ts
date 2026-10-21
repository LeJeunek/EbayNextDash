import { createMcpHandler } from "@modelcontextprotocol/server";
import { buildDemoMcpServer } from "@/lib/mcp/server";
import { isDemoEnabled } from "@/lib/demo/config"; // ← new

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mcpHandler = createMcpHandler(() => buildDemoMcpServer(), {
  maxRequestBodySize: 64 * 1024,
});

export async function POST(request: Request) {
  if (!isDemoEnabled()) {
    // ← new
    return new Response("Not found", { status: 404 }); // ← new
  } // ← new
  return mcpHandler.fetch(request);
}

export const GET = POST;
export const DELETE = POST;
