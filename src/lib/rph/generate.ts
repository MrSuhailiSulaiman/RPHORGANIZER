import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { geminiApiKey } from "@/lib/runtime-env";
import type { KurikulumPilihan } from "./types";
import { ratakanKurikulum, type UnitKurikulum } from "./tahun";

const bahanSchema = z.object({
  bahan: z.array(
    z.object({
      sk_kod: z.string(),
      objektif: z.array(z.string()).min(2).max(3),
      bbm: z.string(),
      nilai: z.string(),
      aktiviti: z.array(z.string()).min(4).max(6),
    })
  ),
});

export type BahanRph = {
  objektif: string[];
  bbm: string;
  nilai: string;
  aktiviti: string[];
};

export function hasGeminiKey() {
  return Boolean(geminiApiKey());
}

function bahanAsal(unit: UnitKurikulum): BahanRph {
  const pernyataan = unit.standard_pembelajaran.map((item) => item.pernyataan).join("; ");
  return {
    objektif: [
      `Murid dapat menjelaskan ${unit.sk_tajuk.toLowerCase()} berdasarkan standard pembelajaran.`,
      `Murid dapat melaksanakan aktiviti PdP berkaitan ${unit.sk_kod}.`,
    ],
    bbm: "Buku teks, nota guru, komputer, LCD, lembaran kerja",
    nilai: "PEMIKIR",
    aktiviti: [
      `Set induksi: soalan pencetus tentang ${unit.sk_tajuk}.`,
      `Guru menerangkan ${unit.sk_kod} ${unit.sk_tajuk}.`,
      `Murid meneliti standard pembelajaran: ${pernyataan.slice(0, 180)}.`,
      "Aktiviti berkumpulan: bincang dan hasilkan tugasan.",
      "Persembahan kumpulan dan rumusan guru.",
      "Penilaian formatif dan penutup.",
    ],
  };
}

export async function janaBahanKurikulum(kurikulum: KurikulumPilihan) {
  const unitList = ratakanKurikulum(kurikulum);
  const peta = new Map<string, BahanRph>();
  for (const unit of unitList) peta.set(unit.sk_kod, bahanAsal(unit));
  if (!unitList.length || !hasGeminiKey()) return peta;

  const ringkas = unitList.map((unit) => ({
    sk_kod: unit.sk_kod,
    sk_tajuk: unit.sk_tajuk,
    bidang: unit.bidang_nama,
    standard_pembelajaran: unit.standard_pembelajaran.map((item) => `${item.kod} ${item.pernyataan}`),
  }));

  const saiz = 40;
  for (let i = 0; i < ringkas.length; i += saiz) {
    const bahagian = ringkas.slice(i, i + saiz);
    try {
      const { output } = await generateText({
        model: createGoogleGenerativeAI({ apiKey: geminiApiKey() })("gemini-2.5-flash"),
        output: Output.object({ schema: bahanSchema }),
        prompt: `Anda guru pakar KSSM Malaysia. Tulis kandungan RPH dalam bahasa Melayu standard sekolah.

Mata pelajaran: ${kurikulum.mata_pelajaran}
Tingkatan: ${kurikulum.tingkatan ?? "-"}

Untuk SETIAP Standard Kandungan, hasilkan:
- objektif: 2-3 ayat bermula "Murid dapat ..." (boleh diukur)
- bbm: bahan bantu mengajar yang realistik di sekolah
- nilai: satu nilai murni KSSM (contoh PEMIKIR, PRIHATIN, AMANAH)
- aktiviti: 5-6 langkah PdP (set induksi, penerangan, aktiviti murid, penilaian, penutup)

Ikut Standard Pembelajaran yang diberi. Jangan cipta kod baharu.

${JSON.stringify(bahagian, null, 2)}`,
      });
      for (const item of output?.bahan ?? []) {
        if (!item.sk_kod) continue;
        peta.set(item.sk_kod, {
          objektif: item.objektif.filter(Boolean).slice(0, 3),
          bbm: item.bbm,
          nilai: item.nilai || "PEMIKIR",
          aktiviti: item.aktiviti.filter(Boolean).slice(0, 6),
        });
      }
    } catch (error) {
      console.error("janaBahanKurikulum", error);
    }
  }

  return peta;
}
