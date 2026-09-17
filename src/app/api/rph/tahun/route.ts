import { connection } from "next/server";
import { NextResponse } from "next/server";
import { padamSemuaRph, senaraiRph } from "@/lib/rph/save";
import { supabaseRuntimeConfig } from "@/lib/runtime-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const fetchCache = "force-no-store";

async function padam() {
  await connection();
  const cfg = supabaseRuntimeConfig();
  const bilangan = await padamSemuaRph(cfg);
  return NextResponse.json(
    { bil_rph: bilangan },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET() {
  await connection();
  const { service, role } = supabaseRuntimeConfig();
  const rph = await senaraiRph();
  return NextResponse.json(
    { service_role: service, role, bil_rph: rph.length },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE() {
  try {
    return await padam();
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memadam RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}

export async function POST() {
  try {
    return await padam();
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memadam RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
