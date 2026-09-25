import { connection } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { wajibAdmin } from "@/lib/auth/penjaga";
import { sahkanMaklumatDskp } from "@/lib/dskp/maklumat";
import { dskpExtractSchema } from "@/lib/dskp/schema";
import { kemaskiniDskp } from "@/lib/dskp/save";
import { kunciServisSupabase } from "@/lib/rph/kunci-padam";
import type { DskpExtract } from "@/lib/dskp/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await wajibAdmin();
  if (auth.ralat) return auth.ralat;

  try {
    await connection();
    await kunciServisSupabase();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      mata_pelajaran?: string;
      tingkatan?: string;
      tahun_terbitan?: string | null;
      bidang?: unknown;
    };
    const maklumat = sahkanMaklumatDskp(body.mata_pelajaran ?? "", body.tingkatan ?? "");
    if ("ralat" in maklumat) {
      return NextResponse.json({ ralat: maklumat.ralat }, { status: 400 });
    }

    const extractParsed = dskpExtractSchema.parse({
      mata_pelajaran: maklumat.nama,
      tingkatan: maklumat.tahap,
      tahun_terbitan: body.tahun_terbitan ?? null,
      bidang: body.bidang ?? [],
    });
    const extract: DskpExtract = {
      ...extractParsed,
      kaedah_analisis: "parser",
    };
    await kemaskiniDskp({
      id,
      extract,
      mataPelajaran: maklumat.nama,
      tingkatan: maklumat.tahap,
    });
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ralat: "Kandungan DSKP tidak sah. Semak kod dan ayat." }, { status: 400 });
    }
    const mentah = error instanceof Error ? error.message : "";
    const mesej =
      !mentah || /pattern|JSON|Unexpected/i.test(mentah)
        ? "Gagal mengemas kini DSKP. Semak kandungan dan cuba semula."
        : mentah;
    const status = /tidak dijumpai/i.test(mesej) ? 404 : 500;
    return NextResponse.json({ ralat: mesej }, { status });
  }
}
