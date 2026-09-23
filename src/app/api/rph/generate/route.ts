import { connection } from "next/server";
import { NextResponse } from "next/server";
import { wajibSesi } from "@/lib/auth/penjaga";
import { senaraiSesi } from "@/lib/jadual/save";
import { kunciGemini } from "@/lib/rph/kunci-padam";
import { PERATUS_REFLEKSI_ASAL } from "@/lib/rph/borang";
import { bahanSandaran, janaBahanKurikulum, pilihAktivitiUntukSesi } from "@/lib/rph/generate";
import { supabaseRuntimeConfig } from "@/lib/runtime-env";
import { getSemuaKurikulum, padamSemuaRph, simpanRphPukal } from "@/lib/rph/save";
import {
  BIL_MINGGU_TAHUN,
  isninPadaAtauSelepas,
  susunSlotTahun,
  tarikhMulaTahunAsal,
  tarikhSlot,
  unitUntukSlot,
} from "@/lib/rph/tahun";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const auth = await wajibSesi();
  if (auth.ralat) return auth.ralat;
  const gemini = Boolean(await kunciGemini());
  return NextResponse.json(
    { gemini },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const auth = await wajibSesi();
  if (auth.ralat) return auth.ralat;
  try {
    await connection();
    await kunciGemini();
    const body = (await request.json().catch(() => ({}))) as { tarikh_mula?: string };

    const sesi = await senaraiSesi(auth.sesi.id);
    if (!sesi.length) {
      return NextResponse.json(
        { ralat: "Tiada sesi PdP. Tetapkan jadual waktu dahulu." },
        { status: 422 }
      );
    }

    const kurikulum = await getSemuaKurikulum();
    if (!kurikulum.length) {
      return NextResponse.json(
        { ralat: "Tiada DSKP. Muat naik DSKP dahulu supaya RPH ikut susunan kurikulum." },
        { status: 422 }
      );
    }

    const tarikhMula = isninPadaAtauSelepas(body.tarikh_mula || tarikhMulaTahunAsal());
    const slots = susunSlotTahun({ sesi, kurikulum, tarikhMula });
    if (!slots.some((item) => item.unit)) {
      return NextResponse.json(
        {
          ralat:
            "DSKP tidak sepadan dengan mata pelajaran/tingkatan dalam jadual. Semak nama mata pelajaran pada DSKP dan sesi PdP.",
        },
        { status: 422 }
      );
    }

    const bahanMengikutDokumen = new Map<string, Awaited<ReturnType<typeof janaBahanKurikulum>>>();
    const idDigunakan = new Set(slots.map((item) => item.dokumen_id).filter((id): id is string => Boolean(id)));
    for (const item of kurikulum) {
      if (!idDigunakan.has(item.dokumen_id)) continue;
      bahanMengikutDokumen.set(item.dokumen_id, await janaBahanKurikulum(item));
    }

    const sandaran = bahanSandaran();
    const kiraanSk = new Map<string, number>();
    const rekod = slots.map((slot) => {
      const unit = unitUntukSlot(slot, kurikulum);
      const bahan =
        (unit && slot.dokumen_id
          ? bahanMengikutDokumen.get(slot.dokumen_id)?.get(unit.sk_kod)
          : undefined) ?? sandaran;
      const kunci = `${slot.sesi.mata_pelajaran}|${slot.sesi.kelas}|${unit?.sk_kod ?? ""}`.toLowerCase();
      const indeks = kiraanSk.get(kunci) ?? 0;
      kiraanSk.set(kunci, indeks + 1);

      return {
        sesi_id: slot.sesi.id ?? "",
        tarikh: slot.tarikh,
        hari: slot.sesi.hari,
        masa: slot.sesi.masa,
        tingkatan: slot.sesi.tingkatan,
        kelas: slot.sesi.kelas,
        mata_pelajaran: slot.sesi.mata_pelajaran,
        bidang_kod: unit?.bidang_kod ?? "",
        bidang_nama: unit?.bidang_nama ?? "",
        sk_kod: unit?.sk_kod ?? "",
        sk_tajuk: unit?.sk_tajuk ?? "",
        standard_pembelajaran: unit?.standard_pembelajaran ?? [],
        objektif: bahan.objektif,
        bbm: bahan.bbm,
        nilai: bahan.nilai,
        aktiviti: pilihAktivitiUntukSesi(bahan, indeks, kunci),
        refleksi_peratus: PERATUS_REFLEKSI_ASAL,
        refleksi_berjaya: null,
      };
    });

    const tarikhTamat = tarikhSlot(tarikhMula, BIL_MINGGU_TAHUN, "JUMAAT");
    const cfg = supabaseRuntimeConfig();
    try {
      await padamSemuaRph(cfg, auth.sesi.id);
    } catch (error) {
      console.error("padam_sebelum_jana", error instanceof Error ? error.message : error);
    }
    const bilangan = await simpanRphPukal(rekod, auth.sesi.id);

    return NextResponse.json({
      tarikh_mula: tarikhMula,
      tarikh_tamat: tarikhTamat,
      bil_minggu: BIL_MINGGU_TAHUN,
      bil_rph: bilangan,
    });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal menjana RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
