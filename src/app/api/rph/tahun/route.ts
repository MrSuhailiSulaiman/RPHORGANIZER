import { connection } from "next/server";
import { NextResponse } from "next/server";
import { env } from "node:process";
import { bilanganSemuaRph, padamSemuaRph } from "@/lib/rph/save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const fetchCache = "force-no-store";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function baca(nama: string) {
  const a = env[nama];
  const b = process.env[nama];
  const nilai = (typeof a === "string" && a.trim() ? a : typeof b === "string" ? b : "").trim();
  return nilai;
}

async function kunciPadam() {
  await connection();
  for (let cubaan = 0; cubaan < 6; cubaan += 1) {
    const url = baca("SUPABASE_URL") || baca("NEXT_PUBLIC_SUPABASE_URL");
    const key = baca("SUPABASE_SERVICE_ROLE_KEY");
    if (url && key) return { url, key };
    await new Promise((selesai) => setTimeout(selesai, 100 * (cubaan + 1)));
    await connection();
  }
  return {
    url: baca("SUPABASE_URL") || baca("NEXT_PUBLIC_SUPABASE_URL"),
    key: baca("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

async function padam() {
  const cfg = await kunciPadam();
  if (!cfg.url || !cfg.key) {
    return json(
      { ralat: "Padam RPH memerlukan SUPABASE_SERVICE_ROLE_KEY. Rekod dalam Supabase tidak dipadam." },
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
  const cfg = await kunciPadam();
  const bil_rph = await bilanganSemuaRph(cfg);
  return json({
    service_role: Boolean(cfg.key),
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
