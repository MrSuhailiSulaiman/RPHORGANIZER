import { connection } from "next/server";
import { NextResponse } from "next/server";
import { wajibSesi } from "@/lib/auth/penjaga";
import { kunciServisSupabase } from "@/lib/rph/kunci-padam";
import { getKurikulum, getRphMengikutId, padamRphPukal, senaraiRph, simpanRph } from "@/lib/rph/save";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await wajibSesi();
  if (auth.ralat) return auth.ralat;
  await connection();
  const url = new URL(request.url);
  const kurikulum = url.searchParams.get("kurikulum");
  const idsParam = url.searchParams.get("ids") ?? "";
  const mata = url.searchParams.get("mata_pelajaran") ?? "";
  const tingkatan = url.searchParams.get("tingkatan") ?? "";

  if (idsParam) {
    try {
      const ids = idsParam.split(/[,\s]+/).map((id) => id.trim()).filter(Boolean);
      const rph = await getRphMengikutId(ids, auth.sesi.id);
      return NextResponse.json({ rph }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const mesej = error instanceof Error ? error.message : "Gagal memuatkan RPH.";
      return NextResponse.json({ ralat: mesej }, { status: 500 });
    }
  }

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
    const rph = await senaraiRph(auth.sesi.id);
    return NextResponse.json(
      { dikonfigurasi: true, rph },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memuatkan RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await wajibSesi();
  if (auth.ralat) return auth.ralat;
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const ids = Array.isArray(payload.ids) ? payload.ids.map((id) => String(id).trim()).filter(Boolean) : [];
    if (ids.length) {
      await connection();
      const cfg = await kunciServisSupabase();
      if (!cfg.url || !cfg.key) {
        return NextResponse.json(
          { ralat: "Padam RPH memerlukan kunci servis Supabase." },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
      const bil = await padamRphPukal(ids, cfg, auth.sesi.id);
      return NextResponse.json({ ok: true, bil }, { headers: { "Cache-Control": "no-store" } });
    }
    if (!payload.mata_pelajaran || !payload.kelas || !payload.hari) {
      return NextResponse.json(
        { ralat: "Kelas, hari, dan mata pelajaran diperlukan." },
        { status: 400 }
      );
    }
    const result = await simpanRph(payload, auth.sesi.id);
    return NextResponse.json({ id: result.id });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal menyimpan RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await wajibSesi();
  if (auth.ralat) return auth.ralat;
  try {
    await connection();
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id).trim()).filter(Boolean) : [];
    if (!ids.length) {
      return NextResponse.json({ ralat: "Pilih sekurang-kurangnya satu rekod RPH." }, { status: 400 });
    }
    const cfg = await kunciServisSupabase();
    if (!cfg.url || !cfg.key) {
      return NextResponse.json(
        { ralat: "Padam RPH memerlukan kunci servis Supabase." },
        { status: 500 }
      );
    }
    const bil = await padamRphPukal(ids, cfg, auth.sesi.id);
    return NextResponse.json({ ok: true, bil }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memadam RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
