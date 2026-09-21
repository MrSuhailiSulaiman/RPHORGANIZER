import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { bacaMuatanSesi, NAMA_KUKI_SESI } from "@/lib/auth/sesi";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const awam =
    path === "/masuk" ||
    path === "/api/auth/masuk" ||
    path === "/api/auth/keluar" ||
    path === "/api/auth/saya" ||
    path.startsWith("/_next") ||
    path === "/favicon.ico";
  const sesi = await bacaMuatanSesi(request.cookies.get(NAMA_KUKI_SESI)?.value);

  if (path === "/daftar") {
    const url = request.nextUrl.clone();
    url.search = "";
    url.pathname = sesi?.peranan === "admin" ? "/pengguna" : sesi ? "/" : "/masuk";
    return NextResponse.redirect(url);
  }

  if (!sesi && !awam) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ ralat: "Sila log masuk." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/masuk";
    url.search = path !== "/" ? `?dari=${encodeURIComponent(path + request.nextUrl.search)}` : "";
    return NextResponse.redirect(url);
  }

  if (sesi && path === "/masuk") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
