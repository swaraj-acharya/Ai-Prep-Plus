/**
 * Runs before every page and API request. Without a valid sign-in cookie, pages redirect to /login
 * and API requests get a 401. (Next.js 16 "proxy", formerly middleware.)
 */
import { NextResponse, type NextRequest } from "next/server";
import { authBypass, COOKIE, safeNext, verifyToken } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (authBypass()) return NextResponse.next();
  const signedIn = await verifyToken(req.cookies.get(COOKIE)?.value);

  if (pathname === "/login") {
    return signedIn ? NextResponse.redirect(new URL(safeNext(req.nextUrl.searchParams.get("next")), req.url)) : NextResponse.next();
  }
  if (signedIn) return NextResponse.next();

  if (pathname.startsWith("/api/") || /\.[a-z0-9]+$/i.test(pathname)) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in first." } }, { status: 401 });
  }
  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  const res = NextResponse.redirect(url);
  if (req.cookies.has(COOKIE)) res.cookies.delete(COOKIE); // expired, or signed with an old password
  return res;
}

export const config = {
  // Everything except the sign-in API, health check, build assets and the PWA files.
  matcher: ["/((?!api/auth/|api/health|_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|icon-512.png|icon-maskable-512.png|apple-icon.png|manifest.webmanifest|sw.js).*)"],
};
