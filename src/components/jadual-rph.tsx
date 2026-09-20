"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HARI_LIST, tarikhUntukHari } from "@/lib/jadual/parse";
import type { BorangRphNilai } from "@/lib/rph/borang";
import { gabungKodTajuk } from "@/lib/rph/tahun";
import type { KurikulumPilihan, RphStandard } from "@/lib/rph/types";

const cell = "border border-slate-400 px-2 py-2 align-top";
const labelCell =
  "border border-slate-400 bg-[#6f9fc4] px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-white";
const headerCell =
  "border border-slate-400 bg-[#6f9fc4] px-2 py-2 text-center text-xs font-bold uppercase tracking-wide text-white";
const field =
  "h-8 w-full rounded-none border-0 bg-transparent px-1 text-sm shadow-none outline-none focus-visible:ring-0";

const cacheKurikulum = new Map<string, KurikulumPilihan | null>();
const inflightKurikulum = new Map<string, Promise<KurikulumPilihan | null>>();

function samaKod(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function cariSk(
  bidang: KurikulumPilihan["bidang"],
  kod: string,
  tajuk: string
) {
  const semua = bidang.flatMap((item) => item.standard_kandungan.map((sk) => ({ bidang: item, sk })));
  const kodBersih = kod.trim();
  const tajukBersih = tajuk.trim();
  return (
    semua.find((row) => kodBersih && samaKod(row.sk.kod, kodBersih)) ??
    semua.find(
      (row) =>
        tajukBersih &&
        (samaKod(row.sk.tajuk, tajukBersih) || samaKod(gabungKodTajuk(row.sk.kod, row.sk.tajuk), tajukBersih))
    ) ??
    null
  );
}

function muatKurikulum(mata: string, tingkatan: string) {
  const kunci = `${mata}|${tingkatan}`;
  if (cacheKurikulum.has(kunci)) return Promise.resolve(cacheKurikulum.get(kunci) ?? null);
  const sedia = inflightKurikulum.get(kunci);
  if (sedia) return sedia;
  const params = new URLSearchParams({
    kurikulum: "1",
    mata_pelajaran: mata,
    tingkatan,
  });
  const janji = fetch(`/api/rph?${params}`)
    .then((res) => res.json())
    .then((json) => {
      const data = (json.kurikulum ?? null) as KurikulumPilihan | null;
      cacheKurikulum.set(kunci, data);
      return data;
    })
    .catch(() => {
      cacheKurikulum.set(kunci, null);
      return null;
    })
    .finally(() => inflightKurikulum.delete(kunci));
  inflightKurikulum.set(kunci, janji);
  return janji;
}

export function JadualRph({
  borang,
  onChange,
  sedangJana = false,
  onTogolSp,
}: {
  borang: BorangRphNilai;
  onChange: (borang: BorangRphNilai) => void;
  sedangJana?: boolean;
  onTogolSp?: (sp: RphStandard, checked: boolean) => void;
}) {
  const [kurikulum, setKurikulum] = useState<KurikulumPilihan | null>(null);
  const namaRefleksi = `refleksi-${borang.id ?? "baru"}`;
  const borangRujukan = useRef(borang);
  const onChangeRujukan = useRef(onChange);
  borangRujukan.current = borang;
  onChangeRujukan.current = onChange;

  useEffect(() => {
    if (!borang.mata_pelajaran) {
      setKurikulum(null);
      return;
    }
    let hidup = true;
    void muatKurikulum(borang.mata_pelajaran, borang.tingkatan).then((data) => {
      if (hidup) setKurikulum(data);
    });
    return () => {
      hidup = false;
    };
  }, [borang.mata_pelajaran, borang.tingkatan]);

  const bidang = kurikulum?.bidang ?? [];

  useEffect(() => {
    const senarai = kurikulum?.bidang ?? [];
    if (!senarai.length) return;
    const current = borangRujukan.current;
    const jumpa = cariSk(senarai, current.sk_kod, current.sk_tajuk);
    if (jumpa) {
      const skTajuk = gabungKodTajuk(jumpa.sk.kod, jumpa.sk.tajuk);
      const bidangNama = gabungKodTajuk(jumpa.bidang.kod, jumpa.bidang.nama);
      if (
        current.sk_kod === jumpa.sk.kod &&
        current.sk_tajuk === skTajuk &&
        current.bidang_kod === jumpa.bidang.kod &&
        current.bidang_nama === bidangNama
      ) {
        return;
      }
      onChangeRujukan.current({
        ...current,
        bidang_kod: jumpa.bidang.kod,
        bidang_nama: bidangNama,
        sk_kod: jumpa.sk.kod,
        sk_tajuk: skTajuk,
      });
      return;
    }
    if (current.sk_kod.trim() || current.sk_tajuk.trim()) return;
    const bidangPilih = senarai.find((item) => samaKod(item.kod, current.bidang_kod)) ?? senarai[0];
    const sk = bidangPilih?.standard_kandungan.find((item) => item.kod || item.tajuk);
    if (!sk || !bidangPilih) return;
    onChangeRujukan.current({
      ...current,
      bidang_kod: current.bidang_kod || bidangPilih.kod,
      bidang_nama: current.bidang_nama || gabungKodTajuk(bidangPilih.kod, bidangPilih.nama),
      sk_kod: sk.kod,
      sk_tajuk: gabungKodTajuk(sk.kod, sk.tajuk),
    });
  }, [kurikulum, borang.id, borang.sk_kod, borang.sk_tajuk, borang.bidang_kod]);

  const skList = useMemo(() => {
    const pilih =
      bidang.find((item) => samaKod(item.kod, borang.bidang_kod)) ??
      cariSk(bidang, borang.sk_kod, borang.sk_tajuk)?.bidang ??
      bidang[0];
    return pilih?.standard_kandungan ?? [];
  }, [bidang, borang.bidang_kod, borang.sk_kod, borang.sk_tajuk]);
  const spList = useMemo(() => {
    const pilih = skList.find((item) => samaKod(item.kod, borang.sk_kod)) ?? skList[0];
    return pilih?.standard_pembelajaran ?? [];
  }, [skList, borang.sk_kod]);
  const skDalamSenarai = skList.some((item) => samaKod(item.kod, borang.sk_kod));
  const bidangDalamSenarai = bidang.some((item) => samaKod(item.kod, borang.bidang_kod));

  function kemaskini(patch: Partial<BorangRphNilai>) {
    onChange({ ...borang, ...patch });
  }

  function pilihBidang(kod: string) {
    const item = bidang.find((row) => samaKod(row.kod, kod));
    kemaskini({
      bidang_kod: kod,
      bidang_nama: item ? gabungKodTajuk(item.kod, item.nama) : borang.bidang_nama,
      sk_kod: "",
      sk_tajuk: "",
      standard_pembelajaran: [],
    });
  }

  function pilihSk(kod: string) {
    const item = skList.find((row) => samaKod(row.kod, kod));
    kemaskini({
      sk_kod: item?.kod || kod,
      sk_tajuk: item ? gabungKodTajuk(item.kod, item.tajuk) : borang.sk_tajuk,
      standard_pembelajaran: [],
    });
  }

  function togolSp(sp: RphStandard, checked: boolean) {
    if (onTogolSp) {
      onTogolSp(sp, checked);
      return;
    }
    kemaskini({
      standard_pembelajaran: checked
        ? [...borang.standard_pembelajaran.filter((item) => item.kod !== sp.kod), sp]
        : borang.standard_pembelajaran.filter((item) => item.kod !== sp.kod),
    });
  }

  return (
    <div className="overflow-x-auto rounded-sm bg-white p-2 text-slate-900 shadow-sm ring-1 ring-slate-300">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr>
            {["Tarikh", "Hari", "Masa", "Tingkatan", "Kelas", "Mata pelajaran"].map((tajuk) => (
              <th key={tajuk} className={headerCell}>
                {tajuk}
              </th>
            ))}
          </tr>
          <tr>
            <td className={cell}>
              <Input
                type="date"
                className={field}
                value={borang.tarikh}
                onChange={(event) => kemaskini({ tarikh: event.target.value })}
              />
            </td>
            <td className={cell}>
              <select
                className={`${field} bg-white`}
                value={borang.hari}
                onChange={(event) =>
                  kemaskini({
                    hari: event.target.value,
                    tarikh: tarikhUntukHari(event.target.value),
                  })
                }
              >
                {HARI_LIST.map((hari) => (
                  <option key={hari} value={hari}>
                    {hari}
                  </option>
                ))}
              </select>
            </td>
            <td className={cell}>
              <Input
                className={field}
                value={borang.masa}
                onChange={(event) => kemaskini({ masa: event.target.value })}
              />
            </td>
            <td className={cell}>
              <Input
                className={field}
                value={borang.tingkatan.replace(/^Tingkatan\s+/i, "")}
                onChange={(event) =>
                  kemaskini({
                    tingkatan: event.target.value
                      ? `Tingkatan ${event.target.value.replace(/^Tingkatan\s+/i, "")}`
                      : "",
                  })
                }
              />
            </td>
            <td className={cell}>
              <Input
                className={field}
                value={borang.kelas}
                onChange={(event) => kemaskini({ kelas: event.target.value })}
              />
            </td>
            <td className={cell}>
              <Input
                className={`${field} uppercase`}
                value={borang.mata_pelajaran}
                onChange={(event) => kemaskini({ mata_pelajaran: event.target.value })}
              />
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th className={labelCell}>Bidang pembelajaran</th>
            <td className={cell} colSpan={5}>
              {bidang.length ? (
                <select
                  className={`${field} bg-white`}
                  value={borang.bidang_kod}
                  onChange={(event) => pilihBidang(event.target.value)}
                >
                  <option value="">Pilih bidang</option>
                  {!bidangDalamSenarai && borang.bidang_kod ? (
                    <option value={borang.bidang_kod}>
                      {borang.bidang_nama || borang.bidang_kod}
                    </option>
                  ) : null}
                  {bidang.map((item) => (
                    <option key={item.kod} value={item.kod}>
                      {item.kod} {item.nama}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  className={field}
                  placeholder="1.0 PENGATURCARAAN"
                  value={borang.bidang_nama}
                  onChange={(event) => kemaskini({ bidang_nama: event.target.value })}
                />
              )}
            </td>
          </tr>
          <tr>
            <th className={labelCell}>Standard kandungan</th>
            <td className={cell} colSpan={5}>
              {skList.length ? (
                <select
                  className={`${field} bg-white`}
                  value={skDalamSenarai ? borang.sk_kod : borang.sk_kod || borang.sk_tajuk}
                  onChange={(event) => pilihSk(event.target.value)}
                >
                  <option value="">Pilih standard kandungan</option>
                  {!skDalamSenarai && (borang.sk_kod || borang.sk_tajuk) ? (
                    <option value={borang.sk_kod || borang.sk_tajuk}>
                      {borang.sk_tajuk || borang.sk_kod}
                    </option>
                  ) : null}
                  {skList.map((item) => (
                    <option key={item.kod || item.tajuk} value={item.kod}>
                      {gabungKodTajuk(item.kod, item.tajuk)}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  className={field}
                  placeholder="1.3 Get Logik"
                  value={borang.sk_tajuk}
                  onChange={(event) => kemaskini({ sk_tajuk: event.target.value })}
                />
              )}
            </td>
          </tr>
          <tr>
            <th className={labelCell}>Standar pembelajaran</th>
            <td className={`${cell} space-y-2`} colSpan={5}>
              {spList.length ? (
                spList.map((sp) => (
                  <label key={sp.kod} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={borang.standard_pembelajaran.some((item) => item.kod === sp.kod)}
                      onChange={(event) => togolSp(sp, event.target.checked)}
                    />
                    <span>
                      <span className="font-medium">{sp.kod}</span> {sp.pernyataan}
                    </span>
                  </label>
                ))
              ) : (
                <Textarea
                  className="min-h-24 rounded-none border-0 shadow-none focus-visible:ring-0"
                  placeholder="1.3.1 Menerangkan get logik..."
                  value={borang.standard_pembelajaran
                    .map((item) => `${item.kod} ${item.pernyataan}`.trim())
                    .join("\n")}
                  onChange={(event) =>
                    kemaskini({
                      standard_pembelajaran: event.target.value.split("\n").map((baris) => ({
                        kod: baris.match(/^\d+(?:\.\d+)*/)?.[0] ?? "",
                        pernyataan: baris.replace(/^\d+(?:\.\d+)*\s*/, "").trim(),
                      })),
                    })
                  }
                />
              )}
            </td>
          </tr>
          <tr>
            <th className={labelCell}>Objektif pembelajaran</th>
            <td className={`${cell} space-y-2`} colSpan={5}>
              {sedangJana ? (
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="size-3 animate-spin" />
                  Gemini sedang menganalisis standard pembelajaran...
                </p>
              ) : null}
              {borang.objektif.map((item, index) => (
                <Textarea
                  key={index}
                  className="min-h-16 rounded-none border-0 shadow-none focus-visible:ring-0"
                  value={item}
                  placeholder="Murid dapat ... (terperinci dan boleh diukur)"
                  onChange={(event) =>
                    kemaskini({
                      objektif: borang.objektif.map((nilai, i) =>
                        i === index ? event.target.value : nilai
                      ),
                    })
                  }
                />
              ))}
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => kemaskini({ objektif: [...borang.objektif, ""] })}
              >
                Tambah objektif
              </Button>
            </td>
          </tr>
          <tr>
            <th className={labelCell}>BBM</th>
            <td className={cell} colSpan={3}>
              <Input
                className={field}
                value={borang.bbm}
                onChange={(event) => kemaskini({ bbm: event.target.value })}
              />
            </td>
            <th className={headerCell}>Nilai</th>
            <td className={cell}>
              <Input
                className={`${field} text-center font-semibold uppercase`}
                value={borang.nilai}
                onChange={(event) => kemaskini({ nilai: event.target.value })}
              />
            </td>
          </tr>
          <tr>
            <th className={labelCell}>Ringkasan aktiviti</th>
            <td className={`${cell} space-y-1`} colSpan={5}>
              {borang.aktiviti.map((item, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="mt-2 w-6 text-right text-xs text-slate-500">{index + 1}.</span>
                  <Textarea
                    className="min-h-16 rounded-none border-0 shadow-none focus-visible:ring-0"
                    value={item}
                    onChange={(event) =>
                      kemaskini({
                        aktiviti: borang.aktiviti.map((nilai, i) =>
                          i === index ? event.target.value : nilai
                        ),
                      })
                    }
                  />
                </div>
              ))}
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => kemaskini({ aktiviti: [...borang.aktiviti, ""] })}
              >
                Tambah aktiviti
              </Button>
            </td>
          </tr>
          <tr>
            <th className={labelCell} rowSpan={3}>
              Refleksi
            </th>
            <td className={cell} colSpan={1}>
              <div className="flex items-center gap-1">
                <Input
                  className={`${field} w-16 text-center`}
                  value={borang.refleksi_peratus}
                  onChange={(event) => kemaskini({ refleksi_peratus: event.target.value })}
                />
                <span>%</span>
              </div>
            </td>
            <td className={cell} colSpan={4}>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={namaRefleksi}
                  checked={borang.refleksi_berjaya === "ya"}
                  onChange={() => kemaskini({ refleksi_berjaya: "ya" })}
                />
                <span>
                  Murid <strong className="text-green-700">berjaya</strong> menguasai objektif pembelajaran
                  dengan baik
                </span>
              </label>
            </td>
          </tr>
          <tr>
            <td className={cell} colSpan={1} />
            <td className={cell} colSpan={4}>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={namaRefleksi}
                  checked={borang.refleksi_berjaya === "tidak"}
                  onChange={() => kemaskini({ refleksi_berjaya: "tidak" })}
                />
                <span>
                  Murid <strong className="text-red-700">tidak berjaya</strong> menguasai objektif
                  pembelajaran dengan baik
                </span>
              </label>
            </td>
          </tr>
          <tr>
            <td className={cell} colSpan={5}>
              <Textarea
                className="min-h-16 rounded-none border-0 shadow-none focus-visible:ring-0"
                placeholder="Catatan refleksi..."
                value={borang.refleksi_catatan}
                onChange={(event) => kemaskini({ refleksi_catatan: event.target.value })}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
