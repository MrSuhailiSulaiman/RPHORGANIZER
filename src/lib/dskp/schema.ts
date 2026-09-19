import { z } from "zod";

function teksAtauNull(value: unknown) {
  if (value == null) return null;
  const teks = String(value).trim();
  return teks.length ? teks : null;
}

function nomborAtauNull(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const nombor = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(nombor) ? nombor : null;
}

function kodTeks(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? `${value}.0` : String(value);
  }
  return String(value ?? "").trim();
}

export const standardPembelajaranSchema = z.object({
  kod: z.preprocess(kodTeks, z.string()).describe("Kod seperti 1.1.1"),
  pernyataan: z.string().describe("Ayat standard pembelajaran tanpa nombor rumawi"),
  butiran: z
    .array(z.string())
    .catch([])
    .describe("Sub-item (i), (ii), (iii) jika ada"),
});

export const standardKandunganSchema = z.object({
  kod: z.preprocess(kodTeks, z.string()).describe("Kod seperti 1.1"),
  tajuk: z.string(),
  standard_pembelajaran: z.array(standardPembelajaranSchema),
});

export const bidangPembelajaranSchema = z.object({
  kod: z.preprocess(kodTeks, z.string()).describe("Kod seperti 1.0"),
  nama: z.string(),
  penerangan: z.preprocess(teksAtauNull, z.string().nullable()),
  jam: z.preprocess(nomborAtauNull, z.number().nullable()),
  standard_kandungan: z.array(standardKandunganSchema),
});

export const dskpExtractSchema = z.object({
  mata_pelajaran: z.string(),
  tingkatan: z.string(),
  tahun_terbitan: z.preprocess(teksAtauNull, z.string().nullable()),
  bidang: z.array(bidangPembelajaranSchema),
});

/** Skema Gemini: string sahaja, tiada null/union yang ditolak responseSchema. */
export const dskpAiSchema = z.object({
  mata_pelajaran: z.string(),
  tingkatan: z.string(),
  tahun_terbitan: z.string(),
  bidang: z.array(
    z.object({
      kod: z.string(),
      nama: z.string(),
      penerangan: z.string(),
      jam: z.string(),
      standard_kandungan: z.array(
        z.object({
          kod: z.string(),
          tajuk: z.string(),
          standard_pembelajaran: z.array(
            z.object({
              kod: z.string(),
              pernyataan: z.string(),
              butiran: z.array(z.string()),
            })
          ),
        })
      ),
    })
  ),
});

export type DskpExtractSchema = z.infer<typeof dskpExtractSchema>;
export type DskpAiSchema = z.infer<typeof dskpAiSchema>;
