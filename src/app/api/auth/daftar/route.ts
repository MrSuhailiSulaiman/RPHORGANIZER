import { NextResponse } from "next/server";
import { wajibAdmin } from "@/lib/auth/penjaga";
import { daftarPengguna } from "@/lib/auth/pengguna";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await wajibAdmin();
  if (auth.ralat) return auth.ralat;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      nama_pengguna?: unknown;
      kata_laluan?: unknown;
    };
    const pengguna = await daftarPengguna(String(body.nama_pengguna ?? ""), String(body.kata_laluan ?? ""));
    return NextResponse.json({
      ok: true,
      pengguna: { id: pengguna.id, nama: pengguna.nama_pengguna, peranan: pengguna.peranan },
    });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal mendaftar.";
    return NextResponse.json({ ralat: mesej }, { status: 400 });
  }
}
