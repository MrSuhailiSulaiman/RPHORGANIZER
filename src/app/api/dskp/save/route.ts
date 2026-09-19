import { connection } from "next/server";
import { NextResponse } from "next/server";
import { dskpExtractSchema } from "@/lib/dskp/schema";
import { sahkanMaklumatDskp } from "@/lib/dskp/maklumat";
import { simpanDskp } from "@/lib/dskp/save";
import { MAX_DSKP_BYTES } from "@/lib/dskp/storage";
import { kunciServisSupabase } from "@/lib/rph/kunci-padam";
import type { DskpExtract } from "@/lib/dskp/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function extractDariPayload(parsedJson: Record<string, unknown>, maklumat: { nama: string; tahap: string }): DskpExtract {
  const extractParsed = dskpExtractSchema.parse(parsedJson);
  return {
    ...extractParsed,
    mata_pelajaran: maklumat.nama,
    tingkatan: maklumat.tahap,
    kaedah_analisis: parsedJson.kaedah_analisis === "ai" ? "ai" : "parser",
    amaran: typeof parsedJson.amaran === "string" ? parsedJson.amaran : undefined,
  };
}

export async function POST(request: Request) {
  try {
    await connection();
    await kunciServisSupabase();
    const jenis = request.headers.get("content-type") ?? "";

    if (jenis.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as {
        path?: string;
        payload?: unknown;
        mata_pelajaran?: string;
        tingkatan?: string;
        nama_fail?: string;
      };
      const maklumat = sahkanMaklumatDskp(body.mata_pelajaran ?? "", body.tingkatan ?? "");
      if ("ralat" in maklumat) {
        return NextResponse.json({ ralat: maklumat.ralat }, { status: 400 });
      }
      const path = typeof body.path === "string" ? body.path.trim() : "";
      if (!path || !body.payload || typeof body.payload !== "object") {
        return NextResponse.json({ ralat: "Fail dan hasil analisis diperlukan." }, { status: 400 });
      }
      const extract = extractDariPayload(body.payload as Record<string, unknown>, maklumat);
      const result = await simpanDskp({
        extract,
        namaFail: typeof body.nama_fail === "string" ? body.nama_fail : "dskp.pdf",
        storagePath: path,
        mataPelajaran: maklumat.nama,
        tingkatan: maklumat.tahap,
      });
      return NextResponse.json({ id: result.id });
    }

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
    if (file.size > MAX_DSKP_BYTES) {
      return NextResponse.json({ ralat: "Fail melebihi 15 MB." }, { status: 400 });
    }

    const parsedJson = JSON.parse(payloadRaw) as Record<string, unknown>;
    const extract = extractDariPayload(parsedJson, maklumat);
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
