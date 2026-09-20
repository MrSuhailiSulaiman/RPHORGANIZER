import { connection } from "next/server";
import { NextResponse } from "next/server";
import { kunciServisSupabase } from "@/lib/rph/kunci-padam";
import { padamRph, padamRphPukal } from "@/lib/rph/save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 300;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

export async function POST(request: Request) {
  try {
    await connection();
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown; id?: unknown };
    const ids = [
      ...(Array.isArray(body.ids) ? body.ids : []),
      ...(body.id != null ? [body.id] : []),
    ]
      .map((id) => String(id).trim())
      .filter(Boolean);
    if (!ids.length) {
      return json({ ralat: "Pilih sekurang-kurangnya satu rekod RPH." }, 400);
    }
    const cfg = await kunciServisSupabase();
    if (!cfg.url || !cfg.key) {
      return json({ ralat: "Padam RPH memerlukan kunci servis Supabase." }, 500);
    }
    const unik = [...new Set(ids)];
    const bil = unik.length === 1 ? (await padamRph(unik[0], cfg), 1) : await padamRphPukal(unik, cfg);
    return json({ ok: true, bil });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memadam RPH.";
    console.error("padam_rph", mesej);
    return json({ ralat: mesej }, 500);
  }
}
