import { NextResponse } from "next/server";
import { getKurikulum, senaraiRph, simpanRph } from "@/lib/rph/save";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kurikulum = url.searchParams.get("kurikulum");
  const mata = url.searchParams.get("mata_pelajaran") ?? "";
  const tingkatan = url.searchParams.get("tingkatan") ?? "";

  if (kurikulum === "1") {
    try {
      const data = await getKurikulum(mata, tingkatan);
      return NextResponse.json({ kurikulum: data });
    } catch (error) {
      const mesej = error instanceof Error ? error.message : "Gagal memuatkan kurikulum.";
      return NextResponse.json({ ralat: mesej }, { status: 500 });
    }
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ dikonfigurasi: false, rph: [] });
  }
  try {
    const rph = await senaraiRph();
    return NextResponse.json({ dikonfigurasi: true, rph });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memuatkan RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    if (!payload.mata_pelajaran || !payload.kelas || !payload.hari) {
      return NextResponse.json(
        { ralat: "Kelas, hari, dan mata pelajaran diperlukan." },
        { status: 400 }
      );
    }
    const result = await simpanRph(payload);
    return NextResponse.json({ id: result.id });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal menyimpan RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
