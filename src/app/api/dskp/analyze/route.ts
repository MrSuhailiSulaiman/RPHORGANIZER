import { connection } from "next/server";
import { NextResponse } from "next/server";
import { analyzeDskp, hasAiProvider } from "@/lib/dskp/analyze";
import { extractPdfText } from "@/lib/dskp/extract-pdf";
import { ringkasanExtract } from "@/lib/dskp/parse";
import { kunciGemini } from "@/lib/rph/kunci-padam";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 15 * 1024 * 1024;

function ralatPengguna(error: unknown) {
  const mesej = error instanceof Error ? error.message : "";
  if (!mesej || /pattern|JSON|Unexpected|timeout|aborted|quota|demand|schema|INVALID/i.test(mesej)) {
    return "Analisis DSKP gagal. Sila cuba semula. Jika fail besar, tunggu sehingga selesai sebelum muat naik semula.";
  }
  return mesej;
}

export async function POST(request: Request) {
  try {
    await connection();
    await kunciGemini();
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ ralat: "Sila muat naik fail PDF." }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ralat: "Sila muat naik fail PDF." }, { status: 400 });
    }
    const jenis = file.type.toLowerCase();
    const namaPdf = file.name.toLowerCase().endsWith(".pdf");
    if (!namaPdf && jenis !== "application/pdf" && jenis !== "application/x-pdf") {
      return NextResponse.json({ ralat: "Fail mestilah PDF DSKP." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ralat: "Fail melebihi 15 MB." }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const pdfBytes = new Uint8Array(buffer);
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

    const extract = await analyzeDskp({ text, pdfBytes });
    const ringkasan = ringkasanExtract(extract);

    return NextResponse.json({
      extract,
      ringkasan,
      jumlahMukaSurat,
      menggunakanAi: hasAiProvider() && extract.kaedah_analisis === "ai",
    });
  } catch (error) {
    console.error("dskp_analyze", error instanceof Error ? error.message : error);
    return NextResponse.json({ ralat: ralatPengguna(error) }, { status: 500 });
  }
}
