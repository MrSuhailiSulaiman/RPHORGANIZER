import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { lengkapkanSesi, parseCsv, parseJadualMatrix } from "@/lib/jadual/parse";
import { muatRujukanMataPelajaran } from "@/lib/jadual/rujukan";
import {
  analyzeJadualVision,
  hasVisionProvider,
  ialahGambarJadual,
  mediaTypeJadual,
} from "@/lib/jadual/vision";
import type { SesiPdp } from "@/lib/jadual/types";

export const runtime = "nodejs";
export const maxDuration = 120;

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
    const rujukan = await muatRujukanMataPelajaran();
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
    } else if (nama.endsWith(".pdf") || ialahGambarJadual(file.name, file.type, bytes) || mediaTypeJadual(file.name, file.type, bytes) === "application/pdf") {
      const mime = mediaTypeJadual(file.name, file.type, bytes);
      if (!mime.startsWith("image/") && mime !== "application/pdf") {
        return NextResponse.json(
          { ralat: "Gunakan gambar (JPG, PNG, WEBP, atau HEIC) atau PDF jadual waktu." },
          { status: 400 }
        );
      }
      if (!hasVisionProvider()) {
        return NextResponse.json(
          {
            ralat:
              "Analisis jadual memerlukan Gemini. Tetapkan GOOGLE_GENERATIVE_AI_API_KEY.",
          },
          { status: 422 }
        );
      }
      sesi = await analyzeJadualVision({ bytes, mediaType: mime, rujukan });
    } else {
      return NextResponse.json(
        { ralat: "Gunakan gambar (JPG/PNG), PDF, CSV, atau Excel jadual waktu." },
        { status: 400 }
      );
    }

    sesi = lengkapkanSesi(sesi, rujukan);
    if (!sesi.length) return tiadaSesi();

    return NextResponse.json({ nama_fail: file.name, sesi });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal membaca jadual waktu.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
