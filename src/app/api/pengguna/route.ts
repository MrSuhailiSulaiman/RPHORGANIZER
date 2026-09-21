import { connection } from "next/server";
import { NextResponse } from "next/server";
import { wajibAdmin } from "@/lib/auth/penjaga";
import { senaraiPengguna } from "@/lib/auth/pengguna";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const auth = await wajibAdmin();
  if (auth.ralat) return auth.ralat;
  try {
    await connection();
    const pengguna = await senaraiPengguna();
    return NextResponse.json({ pengguna }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memuatkan senarai pengguna.";
    return NextResponse.json({ ralat: mesej }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
