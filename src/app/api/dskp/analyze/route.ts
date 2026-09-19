import { connection } from "next/server";
import { NextResponse } from "next/server";
import { analyzeDskp, hasAiProvider } from "@/lib/dskp/analyze";
import { extractPdfText } from "@/lib/dskp/extract-pdf";
import { ringkasanExtract } from "@/lib/dskp/parse";
import { MAX_DSKP_BYTES, muatTurunDskp } from "@/lib/dskp/storage";
import { kunciGemini, kunciServisSupabase } from "@/lib/rph/kunci-padam";

export const runtime = "nodejs";
export const maxDuration = 60;

function ralatPengguna(error: unknown) {
  const mesej = error instanceof Error ? error.message : "";
  if (!mesej || /pattern|JSON|Unexpected|timeout|aborted|quota|demand|schema|INVALID/i.test(mesej)) {
    return "Analisis DSKP gagal. Sila cuba semula.";
  }
  return mesej;
}

async function pdfDariPermintaan(request: Request) {
  const jenis = request.headers.get("content-type") ?? "";
  if (jenis.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { path?: string };
    const path = typeof body.path === "string" ? body.path.trim() : "";
    if (!path) {
      throw new Error("Laluan PDF tidak sah.");
    }
    await kunciServisSupabase();
    return { pdfBytes: await muatTurunDskp(path), path };
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new Error("Sila muat naik fail PDF.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new Error("Sila muat naik fail PDF.");
  }
  const mime = file.type.toLowerCase();
  const namaPdf = file.name.toLowerCase().endsWith(".pdf");
  if (!namaPdf && mime !== "application/pdf" && mime !== "application/x-pdf") {
    throw new Error("Fail mestilah PDF DSKP.");
  }
  if (file.size > MAX_DSKP_BYTES) {
    throw new Error("Fail melebihi 15 MB.");
  }
  return { pdfBytes: new Uint8Array(await file.arrayBuffer()), path: "" };
}

export async function POST(request: Request) {
  try {
    await connection();
    await kunciGemini();
    const { pdfBytes, path } = await pdfDariPermintaan(request);
    let text = "";
    let jumlahMukaSurat = 0;
    try {
      const hasil = await extractPdfText(pdfBytes);
      text = hasil.text;
      jumlahMukaSurat = hasil.jumlahMukaSurat;
    } catch (error) {
      console.error("dskp_pdf", error instanceof Error ? error.message : error);
      return NextResponse.json(
        { ralat: "Teks PDF tidak dapat dibaca. Cuba fail DSKP rasmi KPM." },
        { status: 422 }
      );
    }
    if (!text.trim()) {
      return NextResponse.json(
        { ralat: "Teks PDF tidak dapat dibaca. Cuba fail DSKP rasmi KPM." },
        { status: 422 }
      );
    }

    const extract = await analyzeDskp({ text });
    const ringkasan = ringkasanExtract(extract);

    return NextResponse.json({
      extract,
      ringkasan,
      jumlahMukaSurat,
      path: path || undefined,
      menggunakanAi: hasAiProvider() && extract.kaedah_analisis === "ai",
    });
  } catch (error) {
    console.error("dskp_analyze", error instanceof Error ? error.message : error);
    const mesej = error instanceof Error ? error.message : "";
    const status = /Sila muat naik|Fail mestilah|melebihi|tidak sah/i.test(mesej) ? 400 : 500;
    return NextResponse.json({ ralat: ralatPengguna(error) }, { status });
  }
}
