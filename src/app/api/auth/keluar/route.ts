import { NextResponse } from "next/server";
import { NAMA_KUKI_SESI, pilihanKukiSesi } from "@/lib/auth/sesi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/masuk", request.url), 303);
  res.cookies.set(NAMA_KUKI_SESI, "", { ...pilihanKukiSesi(), maxAge: 0 });
  return res;
}
