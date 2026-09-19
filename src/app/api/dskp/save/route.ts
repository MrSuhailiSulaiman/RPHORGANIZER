import { NextResponse } from "next/server";
import { dskpExtractSchema } from "@/lib/dskp/schema";
import { sahkanMaklumatDskp } from "@/lib/dskp/maklumat";
import { simpanDskp } from "@/lib/dskp/save";
import type { DskpExtract } from "@/lib/dskp/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const payloadRaw = form.get("payload");
    const maklumat = sahkanMaklumatDskp(
      typeof form.get("mata_pelajaran") === "string" ? String(form.get("mata_pelajaran")) : "",
      typeof form.get("tingkatan") === "string" ? String(form.get("tingkatan")) : ""
    );
    if ("ralat" in maklumat) {
      return NextResponse.json({ ralat: maklumat.ralat }, { status: 400 });
    }
    if (!(file instanceof File) || typeof payloadRaw !== "string") {
      return NextResponse.json({ ralat: "Fail dan hasil analisis diperlukan." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ralat: "Fail melebihi 15 MB." }, { status: 400 });
    }

    const parsedJson = JSON.parse(payloadRaw);
    const extractParsed = dskpExtractSchema.parse(parsedJson);
    const extract: DskpExtract = {
      ...extractParsed,
      mata_pelajaran: maklumat.nama,
      tingkatan: maklumat.tahap,
      kaedah_analisis: parsedJson.kaedah_analisis === "ai" ? "ai" : "parser",
      amaran: parsedJson.amaran,
    };

    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const result = await simpanDskp({
      extract,
      namaFail: file.name,
      pdfBytes,
      mataPelajaran: maklumat.nama,
      tingkatan: maklumat.tahap,
    });

    return NextResponse.json({ id: result.id });
  } catch (error) {
    const mentah = error instanceof Error ? error.message : "";
    const mesej =
      !mentah || /pattern|JSON|Unexpected/i.test(mentah)
        ? "Gagal menyimpan DSKP. Semak hasil analisis dan cuba semula."
        : mentah;
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
