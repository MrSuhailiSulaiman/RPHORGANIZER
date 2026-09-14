import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { extractPdfText } from "@/lib/dskp/extract-pdf";
import { parseCsv, parseJadualMatrix, parsePdfJadual, susunSesi } from "@/lib/jadual/parse";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

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
    let matrix: string[][] = [];

    if (nama.endsWith(".csv") || nama.endsWith(".txt")) {
      matrix = parseCsv(new TextDecoder().decode(bytes));
    } else if (nama.endsWith(".xlsx") || nama.endsWith(".xls")) {
      const workbook = XLSX.read(bytes, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
    } else if (nama.endsWith(".pdf")) {
      const extracted = await extractPdfText(bytes);
      matrix = parsePdfJadual(extracted.text);
    } else {
      return NextResponse.json(
        { ralat: "Gunakan CSV, Excel (.xlsx) atau PDF jadual waktu." },
        { status: 400 }
      );
    }

    const sesi = susunSesi(parseJadualMatrix(matrix));
    if (!sesi.length) {
      return NextResponse.json(
        {
          ralat:
            "Tiada sesi PdP dijumpai. Pastikan lajur KELAS, HARI, MASA, dan MATA PELAJARAN ada dalam fail.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ nama_fail: file.name, sesi });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal membaca jadual waktu.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
