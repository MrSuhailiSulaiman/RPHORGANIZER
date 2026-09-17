import { connection } from "next/server";
import { NextResponse } from "next/server";
import { bilanganSemuaRph, padamSemuaRph } from "@/lib/rph/save";
import { supabaseRuntimeConfig } from "@/lib/runtime-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function keRph(request: Request, query: string) {
  return NextResponse.redirect(new URL(`/rph?${query}`, request.url), 303);
}

export async function POST(request: Request) {
  try {
    await connection();
    const cfg = supabaseRuntimeConfig();
    if (!cfg.service || cfg.role !== "service_role") {
      return keRph(request, "padam=kunci");
    }
    await padamSemuaRph(cfg);
    const baki = await bilanganSemuaRph(cfg);
    if (baki > 0) return keRph(request, `padam=baki&n=${baki}`);
    return keRph(request, "padam=ok");
  } catch {
    return keRph(request, "padam=gagal");
  }
}
