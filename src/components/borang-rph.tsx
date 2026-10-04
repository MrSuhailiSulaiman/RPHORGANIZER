"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JadualRph } from "@/components/jadual-rph";
import { tarikhUntukHari } from "@/lib/jadual/parse";
import {
  borangKosong,
  dariRekod,
  muatAktivitiPeperiksaan,
  muatanSimpan,
  terapModRph,
  type BorangRphNilai,
  type ModRph,
} from "@/lib/rph/borang";
import { hantarPadamRph } from "@/lib/rph/padam-pelayar";
import { muatTurunPdfMinggu } from "@/lib/rph/muat-pdf";
import { kumpulanMingguRph, rphMingguSemasa, type KumpulanMingguRph } from "@/lib/rph/tahun";
import { TapisMingguRph } from "@/components/tapis-minggu-rph";
import type { RphRekod, RphStandard } from "@/lib/rph/types";
import type { SesiPdp } from "@/lib/jadual/types";

export function BorangRph({
  sesiId,
  rphId,
}: {
  sesiId?: string;
  rphId?: string;
}) {
  const router = useRouter();
  const [borang, setBorang] = useState<BorangRphNilai>(borangKosong());
  const [sedangMuat, setSedangMuat] = useState(true);
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [sedangPadam, setSedangPadam] = useState(false);
  const [sedangJana, setSedangJana] = useState(false);
  const [sedangPdf, setSedangPdf] = useState(false);
  const [navMinggu, setNavMinggu] = useState<ReturnType<typeof rphMingguSemasa<RphRekod>>>(null);
  const [kumpulanMinggu, setKumpulanMinggu] = useState<KumpulanMingguRph<RphRekod>[]>([]);
  const janaMasa = useRef(0);
  const janaTunda = useRef<ReturnType<typeof setTimeout> | null>(null);
  const borangRujukan = useRef(borang);
  borangRujukan.current = borang;

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
            const senarai = (senaraiJson.rph ?? []) as RphRekod[];
            setBorang(dariRekod(json.rph));
            setKumpulanMinggu(kumpulanMingguRph(senarai));
            setNavMinggu(rphMingguSemasa(senarai, rphId));
            window.scrollTo(0, 0);
          }
          return;
        }
        if (hidup) setNavMinggu(null);
        if (hidup) setKumpulanMinggu([]);
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
        body: JSON.stringify(muatanSimpan(borangRujukan.current)),
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

  async function muatPdfSesi() {
    if (sedangPdf) return;
    if (!borang.id) {
      toast.error("Simpan RPH ini dahulu sebelum dimuat turun.");
      return;
    }
    const kumpul =
      navMinggu ?? kumpulanMinggu.find((item) => item.item.some((row) => row.id === borang.id));
    setSedangPdf(true);
    try {
      await muatTurunPdfMinggu({
        ids: [borang.id],
        minggu: kumpul?.minggu ?? 1,
        tarikh_mula: kumpul?.tarikh_mula,
        tarikh_tamat: kumpul?.tarikh_tamat,
        satu: true,
      });
      toast.success("PDF RPH yang dibuka dimuat turun.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat turun PDF RPH.");
    } finally {
      setSedangPdf(false);
    }
  }

  async function janaPeperiksaan(asas: BorangRphNilai) {
    const masa = ++janaMasa.current;
    setSedangJana(true);
    try {
      const json = await muatAktivitiPeperiksaan(asas);
      if (masa !== janaMasa.current) return;
      setBorang((current) =>
        current.mod === "peperiksaan"
          ? { ...current, aktiviti: json.aktiviti?.length ? json.aktiviti : current.aktiviti }
          : current
      );
      if (json.sandaran) {
        toast.warning(json.sebab ?? "Gemini tidak dapat dihubungi. Aktiviti pengawasan sandaran digunakan.");
      } else {
        toast.success("Aktiviti pengawasan peperiksaan dijana. Semak kemudian simpan.");
      }
    } catch (error) {
      if (masa !== janaMasa.current) return;
      toast.error(error instanceof Error ? error.message : "Gagal menjana aktiviti peperiksaan.");
    } finally {
      if (masa === janaMasa.current) setSedangJana(false);
    }
  }

  function pilihMod(mod: Exclude<ModRph, "pdpc">) {
    if (janaTunda.current) clearTimeout(janaTunda.current);
    if (mod === "cuti") {
      janaMasa.current += 1;
      setSedangJana(false);
      setBorang((current) => terapModRph(current, "cuti"));
      return;
    }
    const seterusnya = terapModRph(borangRujukan.current, "peperiksaan");
    setBorang(seterusnya);
    void janaPeperiksaan(seterusnya);
  }

  async function janaSesi(pilihan?: { standard?: RphStandard[]; skop?: "objektif" | "penuh" }) {
    if (borangRujukan.current.mod === "cuti") {
      toast.error("RPH cuti tidak dijana daripada standard pembelajaran.");
      return;
    }
    if (borangRujukan.current.mod === "peperiksaan") {
      void janaPeperiksaan(borangRujukan.current);
      return;
    }
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
        sandaran?: boolean;
        sebab?: string;
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
      if (json.sandaran) {
        toast.warning(json.sebab ?? "Gemini tidak dapat dihubungi. Templat digunakan — sila semak dan ubah.");
      } else {
        toast.success(
          skop === "objektif"
            ? "Objektif dijana daripada standard pembelajaran. Semak, atau Generate RPH untuk aktiviti."
            : "Objektif dan aktiviti berpusatkan murid telah dijana. Semak kemudian simpan."
        );
      }
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TapisMingguRph
          kumpulan={kumpulanMinggu}
          nilai={navMinggu?.minggu ?? kumpulanMinggu[0]?.minggu ?? "semua"}
          onChange={(pilih) => {
            if (pilih === "semua") return;
            const kumpul = kumpulanMinggu.find((item) => item.minggu === pilih);
            const id = kumpul?.item[0]?.id;
            if (id && id !== rphId) router.push(`/rph/${id}`);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={borang.mod === "peperiksaan" ? "default" : "outline"}
            onClick={() => pilihMod("peperiksaan")}
            disabled={sedangJana}
          >
            Ujian/Peperiksaan
          </Button>
          <Button
            type="button"
            variant={borang.mod === "cuti" ? "default" : "outline"}
            onClick={() => pilihMod("cuti")}
            disabled={sedangJana}
          >
            Cuti
          </Button>
          <Button type="button" onClick={() => void janaSesi()} disabled={sedangJana}>
            {sedangJana ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {sedangJana ? "Menjana RPH..." : "Generate RPH"}
          </Button>
        </div>
      </div>
      <JadualRph
        borang={borang}
        onChange={setBorang}
        sedangJana={sedangJana}
        onTogolSp={togolSp}
      />
      <div className="flex justify-end gap-2">
        {borang.id ? (
          <Button type="button" variant="destructive" onClick={() => void padam()} disabled={sedangPadam}>
            {sedangPadam ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {sedangPadam ? "Memadam..." : "Padam RPH"}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => window.print()}>
          Cetak
        </Button>
        <Button type="button" onClick={() => void janaSesi()} disabled={sedangJana}>
          {sedangJana ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {sedangJana ? "Menjana RPH..." : "Generate RPH"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void muatPdfSesi()}
          disabled={sedangPdf || !borang.id}
        >
          {sedangPdf ? <Loader2 className="animate-spin" /> : <Download />}
          Download RPH
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
