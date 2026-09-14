import { NextResponse } from "next/server";
import { getJadualTerkini, senaraiSesi, simpanJadual } from "@/lib/jadual/save";
import { susunSesi } from "@/lib/jadual/parse";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import type { SesiPdp } from "@/lib/jadual/types";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ dikonfigurasi: false, sesi: [] });
  }
  try {
    const jadual = await getJadualTerkini();
    return NextResponse.json({
      dikonfigurasi: true,
      jadual,
      sesi: jadual?.sesi ?? (await senaraiSesi()),
    });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memuatkan jadual.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { nama_fail?: string; sesi?: SesiPdp[] };
    const sesi = susunSesi(
      (body.sesi ?? []).filter(
        (item) => item.kelas && item.hari && item.masa && item.mata_pelajaran
      )
    );
    if (!sesi.length) {
      return NextResponse.json({ ralat: "Sekurang-kurangnya satu sesi PdP diperlukan." }, { status: 400 });
    }
    const result = await simpanJadual(body.nama_fail?.trim() || "Jadual waktu", sesi);
    const disimpan = await senaraiSesi();
    return NextResponse.json({ id: result.id, sesi: disimpan });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal menyimpan jadual waktu.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
