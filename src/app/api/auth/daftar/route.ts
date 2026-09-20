import { NextResponse } from "next/server";
import { daftarPengguna } from "@/lib/auth/pengguna";
import { NAMA_KUKI_SESI, pilihanKukiSesi, tandaSesi } from "@/lib/auth/sesi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      nama_pengguna?: unknown;
      kata_laluan?: unknown;
    };
    const pengguna = await daftarPengguna(String(body.nama_pengguna ?? ""), String(body.kata_laluan ?? ""));
    const res = NextResponse.json({
      ok: true,
      pengguna: { nama: pengguna.nama_pengguna, peranan: pengguna.peranan },
    });
    res.cookies.set(
      NAMA_KUKI_SESI,
      await tandaSesi({ id: pengguna.id, nama: pengguna.nama_pengguna, peranan: pengguna.peranan }),
      pilihanKukiSesi()
    );
    return res;
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal mendaftar.";
    return NextResponse.json({ ralat: mesej }, { status: 400 });
  }
}
