import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { geminiApiKey, runtimeEnv } from "@/lib/runtime-env";
import { sesiDariSlot, type RujukanMataPelajaran } from "./parse";
import type { SesiPdp } from "./types";

const slotSchema = z.object({
  hari: z.string().describe("ISNIN, SELASA, RABU, KHAMIS atau JUMAAT"),
  masa_mula: z.string().describe("Masa mula HH.MM contoh 08.00"),
  masa_tamat: z.string().describe("Masa tamat HH.MM contoh 08.40"),
  kelas: z.string().describe("Kelas seperti dalam jadual, contoh 4 UTM atau 5 USM"),
  mata_pelajaran: z
    .string()
    .describe("Nama penuh mata pelajaran, contoh SAINS KOMPUTER atau ASAS SAINS KOMPUTER"),
});

const jadualSchema = z.object({
  sesi: z.array(slotSchema),
});

const ARAHAN = `Anda membaca JADUAL WAKTU GURU sekolah Malaysia (Jadual Guru Sidang Pagi).

Format biasa:
- Baris = hari (Isnin, Selasa, Rabu, Khamis, Jumaat)
- Lajur = slot waktu (nombor 0–12) dengan masa seperti 6:30-6:40, 6:40-7:20, 8:00-8:40, 13:00-13:40
- Petak yang ada kelas (contoh 4 UM, 4 UKM, 4 UUM, 5 UITM, 4 UTM, 5 USM) ialah sesi PdP
- Di bawah nama kelas biasanya ada kependekan mata pelajaran
- Salin kod kelas tepat seperti tertulis. UM, UKM, UUM, UITM, UTM dan USM ialah kelas berbeza. Jangan tukar UM kepada UTM.

Kependekan:
- SC KOM / SCKOM / SK = SAINS KOMPUTER
- ASK = ASAS SAINS KOMPUTER
- SEJ = SEJARAH
- GEO = GEOGRAFI

Peraturan:
1. Setiap petak PdP menjadi satu objek sesi: hari, masa_mula, masa_tamat, kelas, mata_pelajaran.
2. Satu kelas yang merentas beberapa lajur masa tetap SATU objek dengan masa mula lajur pertama hingga tamat lajur terakhir. Jangan langkau lajur. Ulang kelas yang sama pada hari atau masa lain sebagai objek berasingan.
3. Senaraikan SEMUA petak yang berisi. Jangan berhenti separuh jadual. Bilangan objek mesti sama dengan bilangan petak PdP yang kelihatan, termasuk petak berganda seperti 13:00-14:20.
4. kelas mesti termasuk nombor tingkatan, contoh "4 UTM" bukan "UTM" sahaja.
5. mata_pelajaran guna nama penuh, bukan kependekan.
6. Abaikan kop sekolah, nama guru, jadual ringkasan Subjek/Kelas/Jumlah di bawah, tandatangan pengetua, motto, dan petak kosong.
7. Jangan cipta sesi untuk rehat, perhimpunan, atau petak kosong.
8. masa_mula dan masa_tamat format HH.MM (contoh 06.40, 13.00, 14.20).`;

export function hasVisionProvider() {
  return Boolean(geminiApiKey() || runtimeEnv("OPENAI_API_KEY") || runtimeEnv("AI_GATEWAY_API_KEY"));
}

const MODEL_GAMBAR = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"] as const;

function modelGambar(nama: (typeof MODEL_GAMBAR)[number]) {
  const gemini = geminiApiKey();
  if (gemini) return createGoogleGenerativeAI({ apiKey: gemini })(nama);
  if (runtimeEnv("OPENAI_API_KEY")) return openai("gpt-4o");
  return `google/${nama}`;
}

function bolehCubaModelLain(error: unknown) {
  const mesej = error instanceof Error ? error.message : String(error);
  return /high demand|no longer available|not found|not supported|404|unavailable|quota|rate[- ]limit|429|resource exhausted|overloaded/i.test(
    mesej
  );
}

function ralatBacaan(error: unknown) {
  const mesej = error instanceof Error ? error.message : "";
  if (/high demand|unavailable|overloaded|429|quota|resource exhausted/i.test(mesej)) {
    return new Error("Gambar JPG atau PNG diterima, tetapi Gemini sedang sibuk. Cuba muat naik semula sebentar lagi.");
  }
  return error instanceof Error ? error : new Error("Gagal membaca gambar jadual.");
}

function adaTanda(bytes: Uint8Array, offset: number, tanda: string) {
  if (bytes.length < offset + tanda.length) return false;
  for (let i = 0; i < tanda.length; i += 1) {
    if (bytes[offset + i] !== tanda.charCodeAt(i)) return false;
  }
  return true;
}

function ialahHeic(bytes: Uint8Array) {
  if (!adaTanda(bytes, 4, "ftyp")) return false;
  const jenama = String.fromCharCode(...bytes.slice(8, 16));
  return /heic|heif|mif1|msf1/i.test(jenama);
}

export function mediaTypeJadual(nama: string, type?: string, bytes?: Uint8Array) {
  const lower = nama.toLowerCase();
  const mime = (type ?? "").toLowerCase();
  if (bytes && adaTanda(bytes, 0, "%PDF")) return "application/pdf";
  if (bytes && bytes.length > 8 && bytes[0] === 0x89 && adaTanda(bytes, 1, "PNG")) return "image/png";
  if (bytes && adaTanda(bytes, 0, "GIF8")) return "image/gif";
  if (bytes && adaTanda(bytes, 0, "RIFF") && adaTanda(bytes, 8, "WEBP")) return "image/webp";
  if (bytes && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if ((bytes && ialahHeic(bytes)) || mime.includes("heic") || mime.includes("heif") || /\.hei[cf]$/.test(lower)) {
    return "image/heic";
  }
  if (mime === "image/png" || lower.endsWith(".png")) return "image/png";
  if (mime === "image/webp" || lower.endsWith(".webp")) return "image/webp";
  if (mime === "image/gif" || lower.endsWith(".gif")) return "image/gif";
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "application/pdf";
  if (mime === "image/jpeg" || mime === "image/jpg" || mime === "image/pjpeg" || /\.jpe?g$/.test(lower)) {
    return "image/jpeg";
  }
  if (mime.startsWith("image/")) return "image/jpeg";
  return "";
}

export function ialahGambarJadual(nama: string, type?: string, bytes?: Uint8Array) {
  const mime = mediaTypeJadual(nama, type, bytes);
  return mime.startsWith("image/");
}

function arahanDenganRujukan(rujukan: RujukanMataPelajaran[]) {
  const senarai = rujukan
    .filter((item) => item.kod.trim() && item.nama.trim())
    .map((item) => `- ${item.kod.trim().toUpperCase()} = ${item.nama.trim().toUpperCase()}`);
  if (!senarai.length) return ARAHAN;
  return `${ARAHAN}

Kod mata pelajaran yang didaftarkan guru (guna nama penuh ini):
${senarai.join("\n")}`;
}

export async function analyzeJadualVision(params: {
  bytes: Uint8Array;
  mediaType: string;
  rujukan?: RujukanMataPelajaran[];
}): Promise<SesiPdp[]> {
  if (!hasVisionProvider()) {
    throw new Error(
      "Untuk gambar atau PDF imbasan, tetapkan GOOGLE_GENERATIVE_AI_API_KEY, OPENAI_API_KEY, atau AI_GATEWAY_API_KEY."
    );
  }

  let terakhir: unknown;
  for (const nama of MODEL_GAMBAR) {
    try {
      const { output } = await generateText({
        model: modelGambar(nama),
        temperature: 0,
        maxOutputTokens: 16384,
        maxRetries: 0,
        output: Output.object({ schema: jadualSchema }),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: arahanDenganRujukan(params.rujukan ?? []) },
              {
                type: "file",
                data: params.bytes,
                mediaType: params.mediaType,
              },
            ],
          },
        ],
      });
      if (output?.sesi?.length) return sesiDariSlot(output.sesi);
    } catch (error) {
      terakhir = error;
      if (!bolehCubaModelLain(error)) throw ralatBacaan(error);
    }
  }
  throw ralatBacaan(terakhir ?? new Error("AI tidak jumpa sesi PdP dalam jadual ini."));
}
