import { NextResponse } from "next/server";
import { sesiSemasa } from "@/lib/auth/penjaga";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sesi = await sesiSemasa();
  if (!sesi) return NextResponse.json({ sesi: null });
  return NextResponse.json({
    sesi: { nama: sesi.nama, peranan: sesi.peranan },
  });
}
