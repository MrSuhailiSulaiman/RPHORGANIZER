import { connection } from "next/server";
import { NextResponse } from "next/server";
import { wajibSesi } from "@/lib/auth/penjaga";
import { kunciServisSupabase } from "@/lib/rph/kunci-padam";
import { getRph, padamRph } from "@/lib/rph/save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await wajibSesi();
  if (auth.ralat) return auth.ralat;
  try {
    const { id } = await params;
    const rph = await getRph(id, auth.sesi.id);
    if (!rph) {
      return NextResponse.json(
        { ralat: "RPH tidak dijumpai." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json({ rph }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memuatkan RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}

async function padamMengikutId(id: string, penggunaId: string) {
  await connection();
  const cfg = await kunciServisSupabase();
  if (!cfg.url || !cfg.key) {
    return NextResponse.json(
      { ralat: "Padam RPH memerlukan kunci servis Supabase." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
  await padamRph(id, cfg, penggunaId);
  return NextResponse.json({ ok: true, bil: 1 }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await wajibSesi();
  if (auth.ralat) return auth.ralat;
  try {
    const { id } = await params;
    return await padamMengikutId(id, auth.sesi.id);
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memadam RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await wajibSesi();
  if (auth.ralat) return auth.ralat;
  try {
    const { id } = await params;
    return await padamMengikutId(id, auth.sesi.id);
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memadam RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
