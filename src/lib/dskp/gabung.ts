/**
 * DSKP yang diekstrak daripada PDF kadangkala memecahkan satu Bidang Pembelajaran
 * kepada beberapa entri (contoh "4.0 Kod Arahan" dua kali) kerana pengepala berulang
 * pada setiap halaman. Borang RPH hanya membaca entri pertama, jadi Standard Kandungan
 * dalam entri kedua tidak kelihatan. Fungsi di sini menggabungkan entri yang sama.
 */

type SpAm = { kod: string; pernyataan: string; butiran?: string[] | null };
type SkAm<SP extends SpAm> = { kod: string; tajuk: string; standard_pembelajaran: SP[] };
type BidangAm<SP extends SpAm, SK extends SkAm<SP>> = {
  kod: string;
  nama: string;
  standard_kandungan: SK[];
};

function normal(nilai: string | null | undefined) {
  return (nilai ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function kunciKod(kod: string | null | undefined, sandaran: string | null | undefined) {
  const k = normal(kod).replace(/\.$/, "");
  return k || normal(sandaran);
}

function butiranSp(sp: SpAm) {
  return Array.isArray(sp.butiran) ? sp.butiran.filter((item) => item.trim()) : [];
}

function gabungSp<SP extends SpAm>(senarai: SP[]): SP[] {
  const peta = new Map<string, SP>();
  for (const sp of senarai) {
    const kunci = kunciKod(sp.kod, sp.pernyataan);
    if (!kunci) continue;
    const sedia = peta.get(kunci);
    if (!sedia) {
      peta.set(kunci, sp);
      continue;
    }
    // Kekalkan ayat kemunculan pertama: entri berikutnya biasanya serpihan
    // "Cadangan aktiviti adalah ..." atau "CATATAN" yang tertinggal daripada PDF.
    const butiran = [...new Set([...butiranSp(sedia), ...butiranSp(sp)])];
    peta.set(kunci, butiran.length ? { ...sedia, butiran } : sedia);
  }
  return [...peta.values()];
}

function gabungSk<SP extends SpAm, SK extends SkAm<SP>>(senarai: SK[]): SK[] {
  const peta = new Map<string, SK>();
  for (const sk of senarai) {
    const kunci = kunciKod(sk.kod, sk.tajuk);
    if (!kunci) continue;
    const sedia = peta.get(kunci);
    if (!sedia) {
      peta.set(kunci, { ...sk, standard_pembelajaran: gabungSp(sk.standard_pembelajaran ?? []) });
      continue;
    }
    peta.set(kunci, {
      ...sedia,
      standard_pembelajaran: gabungSp([
        ...(sedia.standard_pembelajaran ?? []),
        ...(sk.standard_pembelajaran ?? []),
      ]),
    });
  }
  return [...peta.values()];
}

/** Gabung Bidang Pembelajaran yang sama, termasuk SK dan SP di dalamnya. */
export function gabungBidangSama<
  SP extends SpAm,
  SK extends SkAm<SP>,
  B extends BidangAm<SP, SK>,
>(bidang: B[]): B[] {
  const peta = new Map<string, B>();
  for (const item of bidang) {
    const kunci = kunciKod(item.kod, item.nama);
    if (!kunci) continue;
    const sedia = peta.get(kunci);
    if (!sedia) {
      peta.set(kunci, { ...item, standard_kandungan: gabungSk(item.standard_kandungan ?? []) });
      continue;
    }
    peta.set(kunci, {
      ...sedia,
      standard_kandungan: gabungSk([
        ...(sedia.standard_kandungan ?? []),
        ...(item.standard_kandungan ?? []),
      ]),
    });
  }
  return [...peta.values()];
}
