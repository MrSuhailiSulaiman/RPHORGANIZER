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
      objektif: z.array(z.string().min(80).max(500).regex(/\d/)).min(2).max(3),
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

const ayatObjektifSesi = z
  .string()
  .min(130)
  .max(500)
  .regex(/\d/, "Objektif mesti ada nombor yang boleh diukur, contoh 3 atau 4");

const sesiSchema = z.object({
  objektif: z.array(ayatObjektifSesi).min(2).max(3),
  bbm: z.string(),
  nilai: z.string(),
  aktiviti: z.array(z.string()).min(5).max(8),
});

const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
] as const;

function googleModel(nama: string) {
  return createGoogleGenerativeAI({ apiKey: geminiApiKey() })(nama);
}

function bolehCubaModelLain(error: unknown) {
  const mesej = error instanceof Error ? error.message : String(error);
  return /high demand|no longer available|not found|not supported|404|unavailable|quota|rate[- ]limit|429|resource exhausted|overloaded/i.test(
    mesej
  );
}

async function janaObjek<T>(schema: z.ZodType<T>, prompt: string): Promise<T> {
  let last: unknown;
  for (const nama of GEMINI_MODELS) {
    try {
        const { output } = await generateText({
          model: googleModel(nama),
          output: Output.object({ schema }),
          prompt,
          maxRetries: 1,
        });
      if (output) return output;
    } catch (error) {
      last = error;
      console.error("gemini_model", nama, error instanceof Error ? error.message : error);
      if (!bolehCubaModelLain(error)) throw error;
    }
  }
  throw last instanceof Error ? last : new Error("Gemini gagal menjana kandungan RPH.");
}

export async function janaBahanSesi(input: {
  mata_pelajaran: string;
  tingkatan: string;
  kelas: string;
  hari: string;
  masa: string;
  bidang_nama: string;
  sk_kod: string;
  sk_tajuk: string;
  standard_pembelajaran: { kod: string; pernyataan: string }[];
}): Promise<BahanRph> {
  const sp = input.standard_pembelajaran.filter((item) => item.pernyataan.trim());
  if (!sp.length) {
    throw new Error("Pilih standard pembelajaran dahulu.");
  }
  if (!hasGeminiKey()) {
    throw new Error("Kunci Gemini belum dikonfigurasi.");
  }

  const output = await janaObjek(sesiSchema, `Anda guru pakar KSSM Malaysia. Tulis kandungan RPH untuk SATU sesi PdP dalam bahasa Melayu standard sekolah.

Konteks sesi:
- Mata pelajaran: ${input.mata_pelajaran || "-"}
- Tingkatan: ${input.tingkatan || "-"}
- Kelas: ${input.kelas || "-"}
- Hari: ${input.hari || "-"}
- Masa: ${input.masa || "-"}
- Bidang pembelajaran: ${input.bidang_nama || "-"}
- Standard kandungan: ${[input.sk_kod, input.sk_tajuk].filter(Boolean).join(" ") || "-"}

Standard Pembelajaran yang MESTI diikuti (jangan cipta kod baharu):
${sp.map((item) => `- ${item.kod} ${item.pernyataan}`.trim()).join("\n")}

Tugas:
1. objektif: 2-3 objektif yang SANGAT TERPERINCI dan BOLEH DIUKUR DENGAN JELAS. Setiap objektif SATU ayat panjang bermula "Murid dapat ...".
   WAJIB dalam SETIAP objektif:
   - Kata kerja yang boleh dilihat (menyenaraikan, menulis, menghasilkan, membentangkan, membandingkan, menyelesaikan, mengkategori). JANGAN: memahami, mengetahui, menghayati, menyedari, menghargai, menerangkan tanpa nombor.
   - NOMBOR ARAB yang spesifik (2, 3, 4, 5...). Jangan guna "beberapa", "pelbagai", atau "sesuai".
     * menyenaraikan → nyatakan BERAPA perkara (contoh: 4 keperluan).
     * menulis / menghasilkan → berapa ayat, langkah, atau item.
     * membentangkan → berapa isi utama atau berapa minit.
     * membandingkan → berapa persamaan atau perbezaan.
     * menyelesaikan → berapa senario dan berapa langkah, dalam berapa minit jika sesuai.
   - Kondisi: senario/bahan/cara kerja (contoh: pada lembaran kerja individu berdasarkan senario ralat atur cara).
   - Kriteria lulus yang guru boleh semak ya/tidak dalam sesi ini.
   Padankan dengan Standard Pembelajaran. Jangan salin ayat SP secara verbatim.
   CONTOH BAIK: "Murid dapat menyenaraikan 4 keperluan penyelesaian masalah berstrategi (memahami masalah, merancang langkah, melaksanakan, dan menguji) secara bertulis pada lembaran kerja individu berdasarkan 1 senario ralat atur cara yang diberi, dengan 2 justifikasi yang tepat tanpa merujuk nota."
   CONTOH BAIK: "Murid dapat menulis 5 langkah proses penyelesaian masalah berurutan pada peta i-Think berkumpulan dalam masa 10 minit, dan setiap langkah dinilai tepat oleh guru."
   CONTOH LEMAH (dilarang): "Murid dapat menyenaraikan keperluan penyelesaian masalah berstrategi."
   CONTOH LEMAH (dilarang): "Murid dapat menerangkan keperluan penyelesaian masalah berstrategi."
2. aktiviti: 5-8 langkah PdP yang TERPERINCI dan BERPUSATKAN MURID. Murid yang aktif (meneroka, berbincang, menyelesai masalah, menghasilkan tugasan, mempersembah). Guru sebagai fasilitator, bukan syarahan panjang. Setiap langkah 1-3 ayat: apa murid buat, bagaimana, dan hasil yang dijangka. Susunan: set induksi, aktiviti utama murid, semakan pembelajaran, penutup. Aktiviti mesti membolehkan guru mengukur objektif (contoh: kira sama ada murid berjaya senaraikan 4 perkara).
3. bbm: bahan yang realistik di sekolah Malaysia, menyokong aktiviti murid.
4. nilai: satu nilai murni KSSM (contoh PEMIKIR, PRIHATIN, AMANAH).

Jangan ulang ayat standard pembelajaran secara verbatim sebagai aktiviti. Aktiviti mesti sesuai dengan objektif yang anda tulis.`);

  if (!output) throw new Error("Gemini tidak menghasilkan objektif dan aktiviti.");
  return {
    objektif: output.objektif.map((item) => item.trim()).filter(Boolean).slice(0, 3),
    bbm: output.bbm.trim(),
    nilai: (output.nilai || "PEMIKIR").trim(),
    aktiviti: output.aktiviti.map((item) => item.trim()).filter(Boolean).slice(0, 8),
  };
}

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
      const output = await janaObjek(
        bahanSchema,
        `Anda guru pakar KSSM Malaysia. Tulis kandungan RPH dalam bahasa Melayu standard sekolah.

Mata pelajaran: ${kurikulum.mata_pelajaran}
Tingkatan: ${kurikulum.tingkatan ?? "-"}

Untuk SETIAP Standard Kandungan, hasilkan:
- objektif: 2-3 ayat TERPERINCI bermula "Murid dapat ..." yang BOLEH DIUKUR DENGAN NOMBOR (contoh: menyenaraikan 4 perkara, menulis 5 langkah). Wajib ada nombor Arab. Bukan "memahami/mengetahui/beberapa". Bukan salinan ayat standard pembelajaran.
- bbm: bahan bantu mengajar yang realistik di sekolah
- nilai: satu nilai murni KSSM (contoh PEMIKIR, PRIHATIN, AMANAH)
- aktiviti: 5-6 langkah PdP (set induksi, penerangan, aktiviti murid, penilaian, penutup)

Ikut Standard Pembelajaran yang diberi. Jangan cipta kod baharu.

${JSON.stringify(bahagian, null, 2)}`
      );
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
