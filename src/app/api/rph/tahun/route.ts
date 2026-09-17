import { connection } from "next/server";
import { NextResponse } from "next/server";
import { bilanganSemuaRph, padamSemuaRph } from "@/lib/rph/save";
import { supabaseRuntimeConfig } from "@/lib/runtime-env";

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

async function padam() {
  await connection();
  const cfg = supabaseRuntimeConfig();
  if (!cfg.service || cfg.role !== "service_role") {
    return json(
      {
        ralat: "Padam RPH memerlukan SUPABASE_SERVICE_ROLE_KEY. Rekod dalam Supabase tidak dipadam.",
        service_role: cfg.service,
        role: cfg.role,
      },
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
        role: cfg.role,
      },
      500
    );
  }
  return json({ bil_rph: bilangan, baki: 0, role: cfg.role });
}

export async function GET() {
  await connection();
  const { service, role } = supabaseRuntimeConfig();
  const bil_rph = await bilanganSemuaRph();
  return json({ service_role: service, role, bil_rph });
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
