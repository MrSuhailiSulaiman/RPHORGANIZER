"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JadualRph } from "@/components/jadual-rph";
import { tarikhUntukHari } from "@/lib/jadual/parse";
import { borangKosong, dariRekod, muatanSimpan, type BorangRphNilai } from "@/lib/rph/borang";
import { hantarPadamRph } from "@/lib/rph/padam-pelayar";
import { rphMingguSemasa } from "@/lib/rph/tahun";
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
        body: JSON.stringify(muatanSimpan(borang)),
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
