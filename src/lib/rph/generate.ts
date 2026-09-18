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
  .refine((ayat) => (ayat.match(/\d+/g) ?? []).length >= 2, {
    message: "Objektif mesti ada sekurang-kurangnya dua nombor yang boleh diukur",
  })
  .refine((ayat) => !/^Murid dapat menerangkan [^0-9]+$/i.test(ayat.trim()), {
    message: "Jangan salin ayat standard pembelajaran",
  });

const sesiSchema = z.object({
  objektif: z.array(ayatObjektifSesi).min(2).max(3),
  bbm: z.string(),
  nilai: z.string(),
  aktiviti: z.array(z.string()).min(5).max(8),
});

const objektifSahajaSchema = z.object({
  objektif: z.array(ayatObjektifSesi).min(2).max(3),
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

export function hasGeminiKey() {
  return Boolean(geminiApiKey());
}

function senaraiSp(sp: { kod: string; pernyataan: string }[]) {
  return sp.map((item) => `- ${item.kod} ${item.pernyataan}`.trim()).join("\n");
}

function arahanObjektifDaripadaSp() {
  return `LANGKAH 1 — ANALISIS setiap Standard Pembelajaran. Jangan salin ayatnya.
Untuk setiap SP pecahkan: kod, kata kerja DSKP, konsep yang mesti dikuasai, dan bukti yang boleh dikira dalam SATU sesi PdP.

LANGKAH 2 — TULIS 2-3 objektif yang MENGOPERASIKAN hasil analisis itu.
Setiap objektif SATU ayat panjang bermula "Murid dapat ...".

DILARANG:
- "Murid dapat " diikuti ayat Standard Pembelajaran (contoh dilarang: "Murid dapat menerangkan keperluan penyelesaian masalah berstrategi").
- Kata kerja kabur: memahami, mengetahui, menghayati, menyedari, menghargai.
- Perkataan: beberapa, pelbagai, sesuai.

WAJIB dalam SETIAP objektif — sekurang-kurangnya DUA nombor Arab yang guru boleh semak ya/tidak:
- menyenaraikan → berapa perkara (contoh 4) + berapa senario/justifikasi
- membandingkan → berapa perbezaan (contoh 3) + masa atau bilangan hujah
- menulis/menghasilkan → berapa langkah/ayat + kriteria ketepatan
- membentangkan → berapa isi atau berapa minit

GAYA YANG WAJIB DIIKUTI (isi mengikut SP yang dianalisis):
"Murid dapat menyenaraikan 4 keperluan … berdasarkan 1 senario … dengan 2 justifikasi yang tepat."
"Murid dapat membandingkan 3 perbezaan … dalam masa 10 minit, dengan sekurang-kurangnya 2 hujah yang logik."`;
}

type KonteksSesi = {
  mata_pelajaran: string;
  tingkatan: string;
  kelas: string;
  hari: string;
  masa: string;
  bidang_nama: string;
  sk_kod: string;
  sk_tajuk: string;
  standard_pembelajaran: { kod: string; pernyataan: string }[];
};

function tapisSp(input: KonteksSesi) {
  const sp = input.standard_pembelajaran.filter((item) => item.pernyataan.trim());
  if (!sp.length) throw new Error("Pilih standard pembelajaran dahulu.");
  if (!hasGeminiKey()) throw new Error("Kunci Gemini belum dikonfigurasi.");
  return sp;
}

function promptKonteksSesi(input: KonteksSesi, sp: { kod: string; pernyataan: string }[]) {
  return `Anda guru pakar KSSM Malaysia. Tulis dalam bahasa Melayu standard sekolah.

Konteks sesi:
- Mata pelajaran: ${input.mata_pelajaran || "-"}
- Tingkatan: ${input.tingkatan || "-"}
- Kelas: ${input.kelas || "-"}
- Hari: ${input.hari || "-"}
- Masa: ${input.masa || "-"}
- Bidang pembelajaran: ${input.bidang_nama || "-"}
- Standard kandungan: ${[input.sk_kod, input.sk_tajuk].filter(Boolean).join(" ") || "-"}

Standard Pembelajaran yang mesti dianalisis (jangan cipta kod baharu):
${senaraiSp(sp)}

${arahanObjektifDaripadaSp()}`;
}

export async function janaObjektifSesi(input: KonteksSesi): Promise<string[]> {
  const sp = tapisSp(input);
  const output = await janaObjek(
    objektifSahajaSchema,
    `${promptKonteksSesi(input, sp)}

Hasilkan HANYA medan objektif. Setiap objektif mesti lahir daripada analisis SP di atas, bukan salinan ayat SP.`
  );
  if (!output?.objektif?.length) throw new Error("Gemini tidak menghasilkan objektif.");
  return output.objektif.map((item) => item.trim()).filter(Boolean).slice(0, 3);
}

export async function janaBahanSesi(input: KonteksSesi): Promise<BahanRph> {
  const sp = tapisSp(input);
  const output = await janaObjek(
    sesiSchema,
    `${promptKonteksSesi(input, sp)}

Tugas tambahan:
1. objektif: ikut arahan analisis di atas.
2. aktiviti: 5-8 langkah PdP TERPERINCI dan BERPUSATKAN MURID yang membolehkan guru mengukur objektif (contoh: kira sama ada murid berjaya senaraikan 4 perkara). Guru sebagai fasilitator. Susunan: set induksi, aktiviti utama murid, semakan pembelajaran, penutup.
3. bbm: bahan realistik di sekolah Malaysia.
4. nilai: satu nilai murni KSSM (contoh PEMIKIR, PRIHATIN, AMANAH).

Jangan ulang ayat standard pembelajaran sebagai aktiviti.`
  );

  if (!output) throw new Error("Gemini tidak menghasilkan objektif dan aktiviti.");
  return {
    objektif: output.objektif.map((item) => item.trim()).filter(Boolean).slice(0, 3),
    bbm: output.bbm.trim(),
    nilai: (output.nilai || "PEMIKIR").trim(),
    aktiviti: output.aktiviti.map((item) => item.trim()).filter(Boolean).slice(0, 8),
  };
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
