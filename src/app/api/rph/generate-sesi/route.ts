import { connection } from "next/server";
import { NextResponse } from "next/server";
import { janaBahanSesi, janaObjektifSesi } from "@/lib/rph/generate";
import { geminiApiKey } from "@/lib/runtime-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 90;

function kunciGeminiSedia() {
  return Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      geminiApiKey()
  );
}

export async function POST(request: Request) {
  try {
    await connection();
    geminiApiKey();
    if (!kunciGeminiSedia()) {
      return NextResponse.json(
        { ralat: "Kunci Gemini belum dikonfigurasi. Generate RPH sesi tidak dapat dijalankan." },
        { status: 500 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      mata_pelajaran?: string;
      tingkatan?: string;
      kelas?: string;
      hari?: string;
      masa?: string;
      bidang_nama?: string;
      sk_kod?: string;
      sk_tajuk?: string;
      skop?: string;
      standard_pembelajaran?: { kod?: string; pernyataan?: string }[];
    };

    const standard = Array.isArray(body.standard_pembelajaran)
      ? body.standard_pembelajaran
          .map((item) => ({
            kod: String(item?.kod ?? "").trim(),
            pernyataan: String(item?.pernyataan ?? "").trim(),
          }))
          .filter((item) => item.pernyataan)
      : [];

    if (!standard.length) {
      return NextResponse.json(
        { ralat: "Pilih standard pembelajaran dahulu supaya objektif dan aktiviti mengikut DSKP." },
        { status: 422 }
      );
    }

    const konteks = {
      mata_pelajaran: String(body.mata_pelajaran ?? "").trim(),
      tingkatan: String(body.tingkatan ?? "").trim(),
      kelas: String(body.kelas ?? "").trim(),
      hari: String(body.hari ?? "").trim(),
      masa: String(body.masa ?? "").trim(),
      bidang_nama: String(body.bidang_nama ?? "").trim(),
      sk_kod: String(body.sk_kod ?? "").trim(),
      sk_tajuk: String(body.sk_tajuk ?? "").trim(),
      standard_pembelajaran: standard,
    };

    if (String(body.skop ?? "").trim() === "objektif") {
      const objektif = await janaObjektifSesi(konteks);
      return NextResponse.json({ objektif }, { headers: { "Cache-Control": "no-store" } });
    }

    const bahan = await janaBahanSesi(konteks);

    return NextResponse.json(bahan, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal menjana RPH sesi.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
