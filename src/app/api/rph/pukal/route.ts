import { connection } from "next/server";
import { NextResponse } from "next/server";
import { wajibSesi } from "@/lib/auth/penjaga";
import { simpanRphPukal } from "@/lib/rph/save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await wajibSesi();
  if (auth.ralat) return auth.ralat;
  try {
    await connection();
    const body = (await request.json().catch(() => ({}))) as { senarai?: unknown };
    const senarai = Array.isArray(body.senarai) ? body.senarai : [];
    const muatan = senarai.filter(
      (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object"
    );
    if (!muatan.length) {
      return NextResponse.json({ ralat: "Tiada rekod RPH untuk disimpan." }, { status: 400 });
    }
    const kurang = muatan.find((item) => !item.mata_pelajaran || !item.kelas || !item.hari);
    if (kurang) {
      return NextResponse.json(
        { ralat: "Setiap RPH memerlukan kelas, hari, dan mata pelajaran." },
        { status: 400 }
      );
    }
    const bil = await simpanRphPukal(muatan, auth.sesi.id);
    return NextResponse.json(
      { ok: true, bil },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal menyimpan RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
