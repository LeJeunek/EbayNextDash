// src/app/demo/exit/route.ts
//
// GET /demo/exit — leaves the demo and returns to sign-in.
import { NextRequest, NextResponse } from "next/server";
import { DEMO_COOKIE, demoCookieOptions } from "@/lib/demo/config";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.set(DEMO_COOKIE, "", { ...demoCookieOptions, maxAge: 0 });
  return res;
}
