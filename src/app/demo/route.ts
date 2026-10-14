// src/app/demo/route.ts
//
// GET /demo — the shareable demo link. Marks this browser as a demo visitor
// and opens the dashboard. When demo mode is switched off (DEMO_MODE=off) it
// just sends people to the normal sign-in page.
import { NextRequest, NextResponse } from "next/server";
import {
  DEMO_COOKIE,
  DEMO_COOKIE_VALUE,
  demoCookieOptions,
  isDemoEnabled,
} from "@/lib/demo/config";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  if (!isDemoEnabled()) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.set(DEMO_COOKIE, DEMO_COOKIE_VALUE, demoCookieOptions);
  return res;
}
