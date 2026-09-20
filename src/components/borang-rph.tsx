"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HARI_LIST, tarikhUntukHari } from "@/lib/jadual/parse";
import type { KurikulumPilihan, RphRekod, RphStandard } from "@/lib/rph/types";
import { hantarPadamRph } from "@/lib/rph/padam-pelayar";
import { rphMingguSemasa } from "@/lib/rph/tahun";
import type { SesiPdp } from "@/lib/jadual/types";

type Borang = {
  id?: string;
  sesi_id: string;
  tarikh: string;
  hari: string;
  masa: string;
  tingkatan: string;
  kelas: string;
  mata_pelajaran: string;
  bidang_kod: string;
  bidang_nama: string;
  sk_kod: string;
  sk_tajuk: string;
  standard_pembelajaran: RphStandard[];
  objektif: string[];
  bbm: string;
  nilai: string;
  aktiviti: string[];
  refleksi_peratus: string;
  refleksi_berjaya: "" | "ya" | "tidak";
  refleksi_catatan: string;
};

const NILAI_ASAL = "PEMIKIR";

function borangKosong(sesi?: SesiPdp | null): Borang {
  const hari = sesi?.hari ?? "ISNIN";
  return {
    sesi_id: sesi?.id ?? "",
    tarikh: "",
    hari,
    masa: sesi?.masa ?? "",
    tingkatan: sesi?.tingkatan ?? "",
    kelas: sesi?.kelas ?? "",
    mata_pelajaran: sesi?.mata_pelajaran ?? "",
    bidang_kod: "",
    bidang_nama: "",
    sk_kod: "",
    sk_tajuk: "",
    standard_pembelajaran: [],
    objektif: ["", ""],
    bbm: "",
    nilai: NILAI_ASAL,
    aktiviti: ["", "", "", "", "", ""],
    refleksi_peratus: "85",
    refleksi_berjaya: "",
    refleksi_catatan: "",
  };
}

function dariRekod(rekod: RphRekod): Borang {
  return {
    id: rekod.id,
    sesi_id: rekod.sesi_id ?? "",
    tarikh: rekod.tarikh ?? "",
    hari: rekod.hari ?? "ISNIN",
    masa: rekod.masa ?? "",
    tingkatan: rekod.tingkatan ?? "",
    kelas: rekod.kelas ?? "",
    mata_pelajaran: rekod.mata_pelajaran ?? "",
    bidang_kod: rekod.bidang_kod ?? "",
    bidang_nama: rekod.bidang_nama ?? "",
    sk_kod: rekod.sk_kod ?? "",
    sk_tajuk: rekod.sk_tajuk ?? "",
    standard_pembelajaran: rekod.standard_pembelajaran,
    objektif: rekod.objektif.length ? rekod.objektif : ["", ""],
    bbm: rekod.bbm ?? "",
    nilai: rekod.nilai ?? NILAI_ASAL,
    aktiviti: rekod.aktiviti.length ? rekod.aktiviti : ["", "", "", "", "", ""],
    refleksi_peratus: rekod.refleksi_peratus != null ? String(rekod.refleksi_peratus) : "85",
    refleksi_berjaya: rekod.refleksi_berjaya == null ? "" : rekod.refleksi_berjaya ? "ya" : "tidak",
    refleksi_catatan: rekod.refleksi_catatan ?? "",
  };
}

const cell = "border border-slate-400 px-2 py-2 align-top";
const labelCell =
  "border border-slate-400 bg-[#6f9fc4] px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-white";
const headerCell =
  "border border-slate-400 bg-[#6f9fc4] px-2 py-2 text-center text-xs font-bold uppercase tracking-wide text-white";
const field =
  "h-8 w-full rounded-none border-0 bg-transparent px-1 text-sm shadow-none outline-none focus-visible:ring-0";

export function BorangRph({
  sesiId,
  rphId,
}: {
  sesiId?: string;
  rphId?: string;
}) {
  const router = useRouter();
  const [borang, setBorang] = useState<Borang>(borangKosong());
  const [kurikulum, setKurikulum] = useState<KurikulumPilihan | null>(null);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [sedangPadam, setSedangPadam] = useState(false);
  const [sedangJana, setSedangJana] = useState(false);
  const [navMinggu, setNavMinggu] = useState<ReturnType<typeof rphMingguSemasa<RphRekod>>>(null);
  const janaMasa = useRef(0);
  const janaTunda = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let hidup = true;
    async function muat() {
      setSedangMuat(true);
      try {
        if (rphId) {
          const [res, senaraiRes] = await Promise.all([
            fetch(`/api/rph/${rphId}`, { cache: "no-store" }),
            fetch(`/api/rph?t=${Date.now()}`, { cache: "no-store" }),
          ]);
          const json = await res.json();
          const senaraiJson = await senaraiRes.json();
          if (!res.ok) throw new Error(json.ralat ?? "RPH tidak dijumpai.");
          if (hidup) {
            setBorang(dariRekod(json.rph));
            setNavMinggu(rphMingguSemasa((senaraiJson.rph ?? []) as RphRekod[], rphId));
            window.scrollTo(0, 0);
          }
          return;
        }
        if (hidup) setNavMinggu(null);
        if (sesiId) {
          const res = await fetch(`/api/sesi/${sesiId}`);
          const json = await res.json();
          if (!res.ok) throw new Error(json.ralat ?? "Sesi tidak dijumpai.");
          if (hidup) {
            const awal = borangKosong(json.sesi as SesiPdp);
            awal.tarikh = tarikhUntukHari(awal.hari);
            setBorang(awal);
          }
          return;
        }
        if (hidup) {
          const awal = borangKosong();
          awal.tarikh = tarikhUntukHari(awal.hari);
          setBorang(awal);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal memuatkan borang.");
      } finally {
        if (hidup) setSedangMuat(false);
      }
    }
    void muat();
    return () => {
      hidup = false;
    };
  }, [rphId, sesiId]);

  useEffect(() => {
    return () => {
      if (janaTunda.current) clearTimeout(janaTunda.current);
    };
  }, []);

  useEffect(() => {
    if (!borang.mata_pelajaran) {
      setKurikulum(null);
      return;
    }
    const params = new URLSearchParams({
      kurikulum: "1",
      mata_pelajaran: borang.mata_pelajaran,
      tingkatan: borang.tingkatan,
    });
    fetch(`/api/rph?${params}`)
      .then((res) => res.json())
      .then((json) => setKurikulum(json.kurikulum ?? null))
      .catch(() => setKurikulum(null));
  }, [borang.mata_pelajaran, borang.tingkatan]);

  const bidang = kurikulum?.bidang ?? [];
  const skList = useMemo(() => {
    const pilih = bidang.find((item) => item.kod === borang.bidang_kod) ?? bidang[0];
    return pilih?.standard_kandungan ?? [];
  }, [bidang, borang.bidang_kod]);
  const spList = useMemo(() => {
    const pilih = skList.find((item) => item.kod === borang.sk_kod) ?? skList[0];
    return pilih?.standard_pembelajaran ?? [];
  }, [skList, borang.sk_kod]);

  function pilihBidang(kod: string) {
    const item = bidang.find((row) => row.kod === kod);
    setBorang((current) => ({
      ...current,
      bidang_kod: kod,
      bidang_nama: item ? `${item.kod} ${item.nama}`.trim() : current.bidang_nama,
      sk_kod: "",
      sk_tajuk: "",
      standard_pembelajaran: [],
    }));
  }

  function pilihSk(kod: string) {
    const item = skList.find((row) => row.kod === kod);
    setBorang((current) => ({
      ...current,
      sk_kod: kod,
      sk_tajuk: item ? `${item.kod} ${item.tajuk}`.trim() : current.sk_tajuk,
      standard_pembelajaran: [],
    }));
  }

  function togolSp(sp: RphStandard, checked: boolean) {
    const next = checked
      ? [...borang.standard_pembelajaran.filter((item) => item.kod !== sp.kod), sp]
      : borang.standard_pembelajaran.filter((item) => item.kod !== sp.kod);
    setBorang((current) => ({
      ...current,
      standard_pembelajaran: next,
    }));
    if (janaTunda.current) clearTimeout(janaTunda.current);
    if (!next.length) return;
    janaTunda.current = setTimeout(() => {
      void janaSesi({ standard: next, skop: "objektif" });
    }, 500);
  }

  async function simpan() {
    setSedangSimpan(true);
    try {
      const res = await fetch("/api/rph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...borang,
          refleksi_peratus: borang.refleksi_peratus ? Number(borang.refleksi_peratus) : null,
          refleksi_berjaya:
            borang.refleksi_berjaya === "" ? null : borang.refleksi_berjaya === "ya",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.ralat ?? "Gagal menyimpan RPH.");
      toast.success("RPH disimpan.");
      router.push(`/rph/${json.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan RPH.");
    } finally {
      setSedangSimpan(false);
    }
  }

  async function padam() {
    if (!borang.id || sedangPadam) return;
    setSedangPadam(true);
    try {
      await hantarPadamRph([borang.id]);
      toast.success("Rekod RPH dipadam.");
      router.replace("/rph");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memadam RPH.");
    } finally {
      setSedangPadam(false);
    }
  }

  async function janaSesi(pilihan?: { standard?: RphStandard[]; skop?: "objektif" | "penuh" }) {
    const standard = (pilihan?.standard ?? borang.standard_pembelajaran).filter((item) =>
      item.pernyataan.trim()
    );
    if (!standard.length) {
      toast.error("Pilih standard pembelajaran dahulu.");
      return;
    }
    const skop = pilihan?.skop ?? "penuh";
    const masa = ++janaMasa.current;
    setSedangJana(true);
    try {
      const res = await fetch("/api/rph/generate-sesi", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mata_pelajaran: borang.mata_pelajaran,
          tingkatan: borang.tingkatan,
          kelas: borang.kelas,
          hari: borang.hari,
          masa: borang.masa,
          bidang_nama: borang.bidang_nama,
          sk_kod: borang.sk_kod,
          sk_tajuk: borang.sk_tajuk,
          standard_pembelajaran: standard,
          skop,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ralat?: string;
        objektif?: string[];
        aktiviti?: string[];
        bbm?: string;
        nilai?: string;
      };
      if (masa !== janaMasa.current) return;
      if (!res.ok) throw new Error(json.ralat ?? "Gagal menjana RPH sesi.");
      setBorang((current) => ({
        ...current,
        objektif: json.objektif?.length ? json.objektif : current.objektif,
        ...(skop === "penuh"
          ? {
              aktiviti: json.aktiviti?.length ? json.aktiviti : current.aktiviti,
              bbm: json.bbm?.trim() ? json.bbm : current.bbm,
              nilai: json.nilai?.trim() ? json.nilai : current.nilai,
            }
          : {}),
      }));
      toast.success(
        skop === "objektif"
          ? "Objektif dijana daripada standard pembelajaran. Semak, atau Generate RPH untuk aktiviti."
          : "Objektif dan aktiviti berpusatkan murid telah dijana. Semak kemudian simpan."
      );
    } catch (error) {
      if (masa !== janaMasa.current) return;
      toast.error(error instanceof Error ? error.message : "Gagal menjana RPH sesi.");
    } finally {
      if (masa === janaMasa.current) setSedangJana(false);
    }
  }

  if (sedangMuat) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Menyediakan borang RPH...
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" onClick={() => void janaSesi()} disabled={sedangJana}>
          {sedangJana ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {sedangJana ? "Menjana RPH..." : "Generate RPH"}
        </Button>
      </div>
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
                  onChange={(event) => setBorang((current) => ({ ...current, tarikh: event.target.value }))}
                />
              </td>
              <td className={cell}>
                <select
                  className={`${field} bg-white`}
                  value={borang.hari}
                  onChange={(event) =>
                    setBorang((current) => ({
                      ...current,
                      hari: event.target.value,
                      tarikh: tarikhUntukHari(event.target.value),
                    }))
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
                  onChange={(event) => setBorang((current) => ({ ...current, masa: event.target.value }))}
                />
              </td>
              <td className={cell}>
                <Input
                  className={field}
                  value={borang.tingkatan.replace(/^Tingkatan\s+/i, "")}
                  onChange={(event) =>
                    setBorang((current) => ({
                      ...current,
                      tingkatan: event.target.value ? `Tingkatan ${event.target.value.replace(/^Tingkatan\s+/i, "")}` : "",
                    }))
                  }
                />
              </td>
              <td className={cell}>
                <Input
                  className={field}
                  value={borang.kelas}
                  onChange={(event) => setBorang((current) => ({ ...current, kelas: event.target.value }))}
                />
              </td>
              <td className={cell}>
                <Input
                  className={`${field} uppercase`}
                  value={borang.mata_pelajaran}
                  onChange={(event) =>
                    setBorang((current) => ({ ...current, mata_pelajaran: event.target.value }))
                  }
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
                    onChange={(event) =>
                      setBorang((current) => ({ ...current, bidang_nama: event.target.value }))
                    }
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
                    value={borang.sk_kod}
                    onChange={(event) => pilihSk(event.target.value)}
                  >
                    <option value="">Pilih standard kandungan</option>
                    {skList.map((item) => (
                      <option key={item.kod} value={item.kod}>
                        {item.kod} {item.tajuk}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    className={field}
                    placeholder="1.3 Get Logik"
                    value={borang.sk_tajuk}
                    onChange={(event) =>
                      setBorang((current) => ({ ...current, sk_tajuk: event.target.value }))
                    }
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
                    value={borang.standard_pembelajaran.map((item) => `${item.kod} ${item.pernyataan}`.trim()).join("\n")}
                    onChange={(event) =>
                      setBorang((current) => ({
                        ...current,
                        standard_pembelajaran: event.target.value.split("\n").map((baris) => ({
                          kod: baris.match(/^\d+(?:\.\d+)*/)?.[0] ?? "",
                          pernyataan: baris.replace(/^\d+(?:\.\d+)*\s*/, "").trim(),
                        })),
                      }))
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
                      setBorang((current) => ({
                        ...current,
                        objektif: current.objektif.map((nilai, i) =>
                          i === index ? event.target.value : nilai
                        ),
                      }))
                    }
                  />
                ))}
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setBorang((current) => ({ ...current, objektif: [...current.objektif, ""] }))}
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
                  onChange={(event) => setBorang((current) => ({ ...current, bbm: event.target.value }))}
                />
              </td>
              <th className={headerCell}>Nilai</th>
              <td className={cell}>
                <Input
                  className={`${field} text-center font-semibold uppercase`}
                  value={borang.nilai}
                  onChange={(event) => setBorang((current) => ({ ...current, nilai: event.target.value }))}
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
                        setBorang((current) => ({
                          ...current,
                          aktiviti: current.aktiviti.map((nilai, i) =>
                            i === index ? event.target.value : nilai
                          ),
                        }))
                      }
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setBorang((current) => ({ ...current, aktiviti: [...current.aktiviti, ""] }))}
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
                    onChange={(event) =>
                      setBorang((current) => ({ ...current, refleksi_peratus: event.target.value }))
                    }
                  />
                  <span>%</span>
                </div>
              </td>
              <td className={cell} colSpan={4}>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="refleksi"
                    checked={borang.refleksi_berjaya === "ya"}
                    onChange={() => setBorang((current) => ({ ...current, refleksi_berjaya: "ya" }))}
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
                    name="refleksi"
                    checked={borang.refleksi_berjaya === "tidak"}
                    onChange={() => setBorang((current) => ({ ...current, refleksi_berjaya: "tidak" }))}
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
                  onChange={(event) =>
                    setBorang((current) => ({ ...current, refleksi_catatan: event.target.value }))
                  }
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2">
        {borang.id ? (
          <Button type="button" variant="destructive" onClick={() => void padam()} disabled={sedangPadam}>
            {sedangPadam ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Padam RPH
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => window.print()}>
          Cetak
        </Button>
        <Button type="button" onClick={() => void janaSesi()} disabled={sedangJana}>
          {sedangJana ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {sedangJana ? "Menjana RPH..." : "Generate RPH"}
        </Button>
        <Button type="button" onClick={() => void simpan()} disabled={sedangSimpan}>
          {sedangSimpan ? <Loader2 className="animate-spin" /> : null}
          Simpan RPH
        </Button>
      </div>
      {navMinggu && navMinggu.item.length ? (
        <nav
          className="flex flex-col gap-3 rounded-lg border bg-muted/30 px-3 py-3"
          aria-label={`Navigasi RPH Minggu ${navMinggu.minggu}`}
        >
          <p className="text-center text-sm text-muted-foreground">
            Minggu {navMinggu.minggu} · Sesi {navMinggu.indeks + 1} / {navMinggu.item.length}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {navMinggu.indeks > 0 ? (
              <Button asChild variant="outline">
                <Link href={`/rph/${navMinggu.item[navMinggu.indeks - 1].id}`}>
                  <ChevronLeft />
                  Previous
                </Link>
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled>
                <ChevronLeft />
                Previous
              </Button>
            )}
            <div className="flex min-w-0 flex-1 flex-wrap justify-center gap-1">
              {navMinggu.item.map((item, indeks) => {
                const semasa = item.id === rphId;
                const label = `RPH ${indeks + 1}${item.mata_pelajaran ? `: ${item.mata_pelajaran}` : ""}${item.tarikh ? ` ${item.tarikh}` : ""}`;
                return semasa ? (
                  <span
                    key={item.id}
                    aria-current="page"
                    title={label}
                    className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground"
                  >
                    {indeks + 1}
                  </span>
                ) : (
                  <Link
                    key={item.id}
                    href={`/rph/${item.id}`}
                    title={label}
                    aria-label={label}
                    className="inline-flex size-8 items-center justify-center rounded-md border border-border text-sm font-medium hover:bg-muted"
                  >
                    {indeks + 1}
                  </Link>
                );
              })}
            </div>
            {navMinggu.indeks < navMinggu.item.length - 1 ? (
              <Button asChild variant="outline">
                <Link href={`/rph/${navMinggu.item[navMinggu.indeks + 1].id}`}>
                  Next
                  <ChevronRight />
                </Link>
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled>
                Next
                <ChevronRight />
              </Button>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
