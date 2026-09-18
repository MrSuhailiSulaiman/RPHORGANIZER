import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { kunciServisSupabase } from "@/lib/rph/kunci-padam";
import { bilanganSemuaRph, padamSemuaRph } from "@/lib/rph/save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function keRph(request: Request, query: string) {
  const path = query ? `/rph?${query}` : "/rph";
  return NextResponse.redirect(new URL(path, request.url), 303);
}

async function padamDanPergi(request: Request) {
  try {
    const cfg = await kunciServisSupabase();
    if (!cfg.url || !cfg.key) {
      return keRph(
        request,
        `padam=kunci&m=${encodeURIComponent("Padam RPH memerlukan kunci servis Supabase.")}`
      );
    }
    await padamSemuaRph(cfg);
    const baki = await bilanganSemuaRph(cfg);
    revalidatePath("/rph");
    revalidatePath("/api/rph");
    if (baki > 0) return keRph(request, `padam=baki&n=${baki}`);
    return keRph(request, "padam=ok");
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memadam RPH.";
    console.error("padam_rph_gagal", mesej);
    return keRph(request, `padam=gagal&m=${encodeURIComponent(mesej.slice(0, 160))}`);
  }
}

export async function GET(request: Request) {
  return keRph(request, "");
}

export async function POST(request: Request) {
  return padamDanPergi(request);
}
