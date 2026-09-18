import { connection } from "next/server";
import { NextResponse } from "next/server";
import { kunciServisSupabase } from "@/lib/rph/kunci-padam";
import { getRph, padamRph } from "@/lib/rph/save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rph = await getRph(id);
    if (!rph) {
      return NextResponse.json({ ralat: "RPH tidak dijumpai." }, { status: 404 });
    }
    return NextResponse.json({ rph });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memuatkan RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connection();
    const { id } = await params;
    const cfg = await kunciServisSupabase();
    if (!cfg.url || !cfg.key) {
      return NextResponse.json(
        { ralat: "Padam RPH memerlukan kunci servis Supabase." },
        { status: 500 }
      );
    }
    await padamRph(id, cfg);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memadam RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
