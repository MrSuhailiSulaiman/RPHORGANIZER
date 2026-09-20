import { connection } from "next/server";
import { NextResponse } from "next/server";
import { kunciServisSupabase } from "@/lib/rph/kunci-padam";
import { bilanganSemuaRph, padamSemuaRph } from "@/lib/rph/save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const fetchCache = "force-no-store";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function padam() {
  const cfg = await kunciServisSupabase();
  if (!cfg.url || !cfg.key) {
    return json(
      { ralat: "Padam RPH memerlukan kunci servis Supabase. Rekod dalam pangkalan data tidak dipadam." },
      500
    );
  }
  const bilangan = await padamSemuaRph(cfg);
  const baki = await bilanganSemuaRph(cfg);
  if (baki > 0) {
    return json(
      {
        ralat: `RPH tidak dapat dipadam daripada pangkalan data. ${baki} rekod termasuk id masih wujud dalam Supabase.`,
        bil_rph: bilangan,
        baki,
      },
      500
    );
  }
  return json({ bil_rph: bilangan, baki: 0 });
}

export async function GET() {
  await connection();
  const cfg = await kunciServisSupabase();
  const bil_rph = await bilanganSemuaRph(cfg);
  return json({
    service_role: Boolean(cfg.url && cfg.key),
    bil_rph,
  });
}

export async function DELETE() {
  try {
    return await padam();
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memadam RPH.";
    return json({ ralat: mesej }, 500);
  }
}

export async function POST() {
  try {
    return await padam();
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memadam RPH.";
    return json({ ralat: mesej }, 500);
  }
}
