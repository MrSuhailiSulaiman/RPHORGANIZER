import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { extractPdfText } from "@/lib/dskp/extract-pdf";
import { parseCsv, parseJadualMatrix, parsePdfJadual, susunSesi } from "@/lib/jadual/parse";
import {
  analyzeJadualVision,
  hasVisionProvider,
  ialahGambarJadual,
  mediaTypeJadual,
} from "@/lib/jadual/vision";
import { analyzeJadualOcr } from "@/lib/jadual/ocr";
import type { SesiPdp } from "@/lib/jadual/types";

export const runtime = "nodejs";
export const maxDuration = 90;

const MAX_BYTES = 10 * 1024 * 1024;

function tiadaSesi() {
  return NextResponse.json(
    {
      ralat:
        "Tiada sesi PdP dijumpai. Muat naik gambar/PDF jadual guru, atau fail dengan lajur KELAS, HARI, MASA, dan MATA PELAJARAN.",
    },
    { status: 422 }
  );
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ralat: "Sila muat naik fail jadual waktu." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ralat: "Fail melebihi 10 MB." }, { status: 400 });
    }

    const nama = file.name.toLowerCase();
    const bytes = new Uint8Array(await file.arrayBuffer());
    let sesi: SesiPdp[] = [];

    if (nama.endsWith(".csv") || nama.endsWith(".txt")) {
      sesi = parseJadualMatrix(parseCsv(new TextDecoder().decode(bytes)));
    } else if (nama.endsWith(".xlsx") || nama.endsWith(".xls")) {
      const workbook = XLSX.read(bytes, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        raw: false,
        defval: "",
      });
      sesi = parseJadualMatrix(matrix);
    } else if (nama.endsWith(".pdf")) {
      const extracted = await extractPdfText(bytes);
      sesi = parseJadualMatrix(parsePdfJadual(extracted.text));
      if (!sesi.length) {
        if (!hasVisionProvider()) {
          return NextResponse.json(
            {
              ralat:
                "PDF ini nampak seperti imbasan. Untuk membacanya, tetapkan GOOGLE_GENERATIVE_AI_API_KEY, OPENAI_API_KEY, atau AI_GATEWAY_API_KEY.",
            },
            { status: 422 }
          );
        }
        sesi = await analyzeJadualVision({
          bytes,
          mediaType: "application/pdf",
        });
      }
    } else if (ialahGambarJadual(file.name, file.type)) {
      const mime = mediaTypeJadual(file.name, file.type);
      if (mime === "image/heic" || mime === "image/heif") {
        return NextResponse.json(
          {
            ralat:
              "Gambar iPhone (HEIC) tidak boleh dibaca. Buka gambar, kemudian simpan/kongsi sebagai JPG atau PNG.",
          },
          { status: 422 }
        );
      }
      try {
        sesi = await analyzeJadualOcr(bytes);
      } catch (error) {
        const mesej = error instanceof Error ? error.message : "Gagal membaca gambar jadual.";
        if (!hasVisionProvider()) {
          return NextResponse.json({ ralat: mesej }, { status: 422 });
        }
        try {
          const ai = await analyzeJadualVision({ bytes, mediaType: mime });
          if (ai.length) sesi = ai;
          else return NextResponse.json({ ralat: mesej }, { status: 422 });
        } catch {
          return NextResponse.json({ ralat: mesej }, { status: 422 });
        }
      }
      if (sesi.length < 3 && hasVisionProvider()) {
        try {
          const ai = await analyzeJadualVision({ bytes, mediaType: mime });
          if (ai.length > sesi.length) sesi = ai;
        } catch {
          // kekalkan hasil OCR
        }
      }
      if (!sesi.length) {
        return NextResponse.json(
          {
            ralat:
              "Gambar jadual tidak dapat dibaca. Pastikan grid hari dan waktu nampak jelas, atau muat naik PDF/CSV.",
          },
          { status: 422 }
        );
      }
    } else {
      return NextResponse.json(
        { ralat: "Gunakan gambar (JPG/PNG), PDF, CSV, atau Excel jadual waktu." },
        { status: 400 }
      );
    }

    sesi = susunSesi(sesi);
    if (!sesi.length) return tiadaSesi();

    return NextResponse.json({ nama_fail: file.name, sesi });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal membaca jadual waktu.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
