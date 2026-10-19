// src/app/api/mcp/route.ts
import { createMcpHandler } from "@modelcontextprotocol/server";
import { buildDemoMcpServer } from "@/lib/mcp/server";

// TODO: two Next.js settings, each a one-line export:
//   runtime = "nodejs"         → run on Node.js, not the lighter edge runtime
//   dynamic = "force-dynamic"  → never cache; run fresh on every request
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// TODO: build the handler once, at the top level:
//   createMcpHandler(() => buildDemoMcpServer())
//   You pick the variable name.
const mcpHandler = createMcpHandler(() => buildDemoMcpServer());

// TODO: export an async function POST(request: Request)
//   that returns <your handler>.fetch(request)

export async function POST(request: Request) {
  return mcpHandler.fetch(request);
}

// TODO: also export GET and DELETE, pointing at the same function as POST.
//   (GET will answer 405, "not allowed". That's normal for this kind of server.)
export const GET = POST;
export const DELETE = POST;
