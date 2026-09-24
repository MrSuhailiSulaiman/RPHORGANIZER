import { connection, NextResponse } from "next/server";
import { wajibSesi } from "@/lib/auth/penjaga";
import { kunciGemini } from "@/lib/rph/kunci-padam";
import {
  bahanSandaran,
  janaBahanSesi,
  janaObjektifSesi,
  pilihAktivitiUntukSesi,
  pilihKaedahPdP,
} from "@/lib/rph/generate";
import { tetapkanGeminiEnv } from "@/lib/runtime-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 90;

const SEBAB_TIADA_KUNCI =
  "Kunci Gemini belum dikonfigurasi. Isi GOOGLE_GENERATIVE_AI_API_KEY dalam .env.local, atau pada Vercel kemudian deploy semula.";

export async function POST(request: Request) {
  const auth = await wajibSesi();
  if (auth.ralat) return auth.ralat;
  try {
    await connection();
    const kunci = await kunciGemini();
    if (kunci) tetapkanGeminiEnv(kunci);

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

    const biji = [
      String(body.mata_pelajaran ?? ""),
      String(body.kelas ?? ""),
      String(body.hari ?? ""),
      String(body.masa ?? ""),
      String(body.sk_kod ?? ""),
      String(Date.now()),
    ].join("|");
    const masteri = Date.now() % 4 === 0;
    const hanyaObjektif = String(body.skop ?? "").trim() === "objektif";
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
      kaedah: pilihKaedahPdP(biji, masteri),
      masteri,
    };

    /** Guru tidak boleh tersekat: beri templat yang boleh disunting apabila Gemini gagal. */
    function sandaran(sebab: string) {
      const bahan = bahanSandaran(
        konteks.sk_tajuk || konteks.sk_kod || standard[0].pernyataan,
        standard.map((item) => item.kod).filter(Boolean).join(", ")
      );
      const isi = hanyaObjektif
        ? { objektif: bahan.objektif }
        : {
            objektif: bahan.objektif,
            bbm: bahan.bbm,
            nilai: bahan.nilai,
            aktiviti: pilihAktivitiUntukSesi(bahan, Math.floor(Math.random() * 3), biji),
          };
      return NextResponse.json(
        { ...isi, sandaran: true, sebab },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!kunci) return sandaran(SEBAB_TIADA_KUNCI);

    try {
      if (hanyaObjektif) {
        const objektif = await janaObjektifSesi(konteks, kunci);
        return NextResponse.json({ objektif }, { headers: { "Cache-Control": "no-store" } });
      }
      const bahan = await janaBahanSesi(konteks, kunci);
      return NextResponse.json(bahan, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const mesej = error instanceof Error ? error.message : "Gemini gagal menjana kandungan RPH.";
      console.error("generate_sesi_gemini", mesej);
      return sandaran(mesej);
    }
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal menjana RPH sesi.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
