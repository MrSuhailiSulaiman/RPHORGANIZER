import { connection } from "next/server";
import { NextResponse } from "next/server";
import { wajibSesi } from "@/lib/auth/penjaga";
import { senaraiSesi } from "@/lib/jadual/save";
import { kunciGemini } from "@/lib/rph/kunci-padam";
import { bahanSandaran, janaBahanKurikulum, pilihAktivitiUntukSesi } from "@/lib/rph/generate";
import { getSemuaKurikulum, padamRphDalamTempoh, simpanRphPukal } from "@/lib/rph/save";
import {
  BIL_MINGGU_TAHUN,
  isninPadaAtauSelepas,
  kunciUnit,
  susunSlotTahun,
  tarikhSlot,
  unitUntukSlot,
  type SlotTahun,
} from "@/lib/rph/tahun";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function rekodSlot(slot: SlotTahun, kurikulum: Awaited<ReturnType<typeof getSemuaKurikulum>>, bahanMengikutDokumen: Map<string, Awaited<ReturnType<typeof janaBahanKurikulum>>>, kiraanSk: Map<string, number>) {
  const unit = unitUntukSlot(slot, kurikulum);
  const sandaran = bahanSandaran();
  const bahan =
    (unit && slot.dokumen_id
      ? bahanMengikutDokumen.get(slot.dokumen_id)?.get(kunciUnit(unit))
      : undefined) ??
    (unit
      ? bahanSandaran(unit.sk_tajuk, unit.standard_pembelajaran.map((sp) => sp.kod).filter(Boolean).join(", "))
      : sandaran);
  const kunci = `${slot.sesi.mata_pelajaran}|${slot.sesi.kelas}|${unit ? kunciUnit(unit) : ""}`.toLowerCase();
  const indeks = kiraanSk.get(kunci) ?? 0;
  kiraanSk.set(kunci, indeks + 1);
  return {
    indeks,
    kunci,
    rekod: {
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
      refleksi_peratus: null,
      refleksi_berjaya: "belum",
    },
  };
}

export async function POST(request: Request) {
  const auth = await wajibSesi();
  if (auth.ralat) return auth.ralat;
  try {
    await connection();
    await kunciGemini();
    const body = (await request.json().catch(() => ({}))) as { minggu?: number; tarikh_isnin?: string };
    const minggu = Number(body.minggu);
    if (!Number.isInteger(minggu) || minggu < 1 || minggu > BIL_MINGGU_TAHUN) {
      return NextResponse.json({ ralat: `Minggu mesti antara 1 dan ${BIL_MINGGU_TAHUN}.` }, { status: 400 });
    }
    const isnin = String(body.tarikh_isnin ?? "").trim();
    if (!isnin || isninPadaAtauSelepas(isnin) !== isnin) {
      return NextResponse.json({ ralat: "Pilih tarikh hari Isnin." }, { status: 400 });
    }

    const sesi = await senaraiSesi(auth.sesi.id);
    if (!sesi.length) {
      return NextResponse.json({ ralat: "Tiada sesi PdP. Tetapkan jadual waktu dahulu." }, { status: 422 });
    }

    const kurikulum = await getSemuaKurikulum();
    if (!kurikulum.length) {
      return NextResponse.json(
        { ralat: "Tiada DSKP. Muat naik DSKP dahulu supaya RPH ikut susunan kurikulum." },
        { status: 422 }
      );
    }

    const semua = susunSlotTahun({
      sesi,
      kurikulum,
      tarikhMula: isnin,
      bilMinggu: BIL_MINGGU_TAHUN,
    });
    const slots = semua
      .filter((slot) => slot.minggu === minggu)
      .map((slot) => ({
        ...slot,
        tarikh: tarikhSlot(isnin, 1, slot.sesi.hari),
      }));
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
    const hadGemini = AbortSignal.timeout(100_000);
    for (const item of kurikulum) {
      if (!idDigunakan.has(item.dokumen_id)) continue;
      const unik = new Map<string, NonNullable<(typeof slots)[number]["unit"]>>();
      for (const slot of slots) {
        if (slot.dokumen_id !== item.dokumen_id || !slot.unit) continue;
        unik.set(kunciUnit(slot.unit), slot.unit);
      }
      if (!unik.size) continue;
      bahanMengikutDokumen.set(item.dokumen_id, await janaBahanKurikulum(item, [...unik.values()], hadGemini));
    }

    const kiraanSk = new Map<string, number>();
    const rekod = [];
    for (const slot of semua) {
      const tarikh = slot.minggu === minggu ? tarikhSlot(isnin, 1, slot.sesi.hari) : slot.tarikh;
      const hasil = rekodSlot({ ...slot, tarikh }, kurikulum, bahanMengikutDokumen, kiraanSk);
      if (slot.minggu === minggu) rekod.push(hasil.rekod);
    }

    const tarikhTamat = tarikhSlot(isnin, 1, "JUMAAT");
    await padamRphDalamTempoh(isnin, tarikhTamat, auth.sesi.id);
    const bilangan = await simpanRphPukal(rekod, auth.sesi.id);

    return NextResponse.json({
      minggu,
      tarikh_mula: isnin,
      tarikh_tamat: tarikhTamat,
      bil_rph: bilangan,
    });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal menjana RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
