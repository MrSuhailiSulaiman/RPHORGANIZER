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
- Petak yang ada kelas (contoh 4 UTM, 5 USM, 3 UTM) ialah sesi PdP
- Di bawah nama kelas biasanya ada kependekan mata pelajaran

Kependekan:
- SC KOM / SCKOM / SK = SAINS KOMPUTER
- ASK = ASAS SAINS KOMPUTER

Peraturan:
1. Setiap petak PdP menjadi satu objek sesi: hari, masa_mula, masa_tamat, kelas, mata_pelajaran.
2. Sel yang merentas dua slot (contoh nota 13:00-14:20) = SATU sesi dengan masa mula hingga tamat penuh.
3. kelas mesti termasuk nombor tingkatan, contoh "4 UTM" bukan "UTM" sahaja.
4. mata_pelajaran guna nama penuh, bukan kependekan.
5. Abaikan kop sekolah, nama guru, jadual ringkasan Subjek/Kelas/Jumlah di bawah, tandatangan pengetua, motto, dan petak kosong.
6. Jangan cipta sesi untuk rehat, perhimpunan, atau petak kosong.
7. masa_mula dan masa_tamat format HH.MM (contoh 06.40, 13.00, 14.20).`;

export function hasVisionProvider() {
  return Boolean(geminiApiKey() || runtimeEnv("OPENAI_API_KEY") || runtimeEnv("AI_GATEWAY_API_KEY"));
}

function modelVision() {
  const gemini = geminiApiKey();
  if (gemini) {
    return createGoogleGenerativeAI({ apiKey: gemini })("gemini-3.6-flash");
  }
  if (runtimeEnv("OPENAI_API_KEY")) {
    return openai("gpt-4o");
  }
  return "google/gemini-3.6-flash";
}

export function mediaTypeJadual(nama: string, type?: string) {
  if (type && type !== "application/octet-stream") return type;
  const lower = nama.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

export function ialahGambarJadual(nama: string, type?: string) {
  const lower = nama.toLowerCase();
  const mime = (type ?? "").toLowerCase();
  return (
    mime.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|heic|heif)$/.test(lower)
  );
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

  const { output } = await generateText({
    model: modelVision(),
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

  if (!output?.sesi?.length) {
    throw new Error("AI tidak jumpa sesi PdP dalam jadual ini.");
  }

  return sesiDariSlot(output.sesi);
}
