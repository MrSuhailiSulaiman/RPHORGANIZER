import { connection } from "next/server";
import { NextResponse } from "next/server";
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

function namaEnv(...bahagian: string[]) {
  return bahagian.join("_");
}

function bacaRuntime(nama: string) {
  const proses = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const nilai = proses?.env?.[nama];
  return typeof nilai === "string" ? nilai.trim() : "";
}

async function kunciPadam() {
  await connection();
  const urlNama = [namaEnv("NEXT", "PUBLIC", "SUPABASE", "URL"), namaEnv("SUPABASE", "URL")];
  const kunciNama = namaEnv("SUPABASE", "SERVICE", "ROLE", "KEY");
  for (let cubaan = 0; cubaan < 8; cubaan += 1) {
    const url = bacaRuntime(urlNama[0]) || bacaRuntime(urlNama[1]);
    const key = bacaRuntime(kunciNama);
    if (url && key) return { url, key };
    await new Promise((selesai) => setTimeout(selesai, 80 * (cubaan + 1)));
    await connection();
  }
  return {
    url: bacaRuntime(urlNama[0]) || bacaRuntime(urlNama[1]),
    key: bacaRuntime(kunciNama),
  };
}

async function padam() {
  const cfg = await kunciPadam();
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
