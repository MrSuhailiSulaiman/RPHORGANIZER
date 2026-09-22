"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ButangKongsiRph } from "@/components/butang-kongsi-rph";
import { Button } from "@/components/ui/button";
import { JadualRph } from "@/components/jadual-rph";
import { TapisMingguRph } from "@/components/tapis-minggu-rph";
import { dariRekod, muatanSimpan, type BorangRphNilai } from "@/lib/rph/borang";
import { muatTurunPdfMinggu } from "@/lib/rph/muat-pdf";
import { bandingSesiRph, kumpulanMingguRph, type KumpulanMingguRph } from "@/lib/rph/tahun";
import type { RphRekod } from "@/lib/rph/types";

export function PaparMingguRph() {
  const router = useRouter();
  const params = useSearchParams();
  const idsParam = params.get("ids") ?? "";
  const minggu = Number(params.get("minggu") ?? "0");
  const ids = useMemo(
    () => idsParam.split(",").map((id) => id.trim()).filter(Boolean),
    [idsParam]
  );
  const [borang, setBorang] = useState<BorangRphNilai[]>([]);
  const [kumpulanMinggu, setKumpulanMinggu] = useState<KumpulanMingguRph<RphRekod>[]>([]);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [sedangPdf, setSedangPdf] = useState(false);

  useEffect(() => {
    let hidup = true;
    async function muat() {
      setSedangMuat(true);
      try {
        const res = await fetch(`/api/rph?t=${Date.now()}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.ralat ?? "Gagal memuatkan RPH minggu ini.");
        const senarai = ((json.rph ?? []) as RphRekod[]).sort(bandingSesiRph);
        const kumpulan = kumpulanMingguRph(senarai);
        const sasaran =
          (minggu > 0 ? kumpulan.find((item) => item.minggu === minggu) : null) ??
          kumpulan.find((item) => item.item.some((row) => ids.includes(row.id))) ??
          kumpulan[0];
        const idMinggu = (sasaran?.item.map((item) => item.id).filter(Boolean) ?? ids).filter(Boolean);

        let penuh: RphRekod[] = [];
        if (idMinggu.length) {
          const penuhRes = await fetch(`/api/rph?ids=${encodeURIComponent(idMinggu.join(","))}`, {
            cache: "no-store",
          });
          const penuhJson = await penuhRes.json();
          if (!penuhRes.ok) throw new Error(penuhJson.ralat ?? "Gagal memuatkan RPH minggu ini.");
          penuh = ((penuhJson.rph ?? []) as RphRekod[]).sort(bandingSesiRph);
        }

        if (hidup) {
          setKumpulanMinggu(kumpulan);
          setBorang(penuh.map(dariRekod));
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal memuatkan RPH minggu ini.");
      } finally {
        if (hidup) setSedangMuat(false);
      }
    }
    void muat();
    return () => {
      hidup = false;
    };
  }, [ids, minggu]);

  function kemaskini(indeks: number, nilai: BorangRphNilai) {
    setBorang((senarai) => senarai.map((item, i) => (i === indeks ? nilai : item)));
  }

  async function simpanSemua() {
    if (!borang.length || sedangSimpan) return;
    setSedangSimpan(true);
    try {
      const res = await fetch("/api/rph/pukal", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senarai: borang.map(muatanSimpan) }),
      });
      const json = (await res.json().catch(() => ({}))) as { ralat?: string; bil?: number };
      if (!res.ok) throw new Error(json.ralat ?? "Gagal menyimpan RPH minggu ini.");
      toast.success(`${json.bil ?? borang.length} RPH minggu ini disimpan.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan RPH minggu ini.");
    } finally {
      setSedangSimpan(false);
    }
  }

  async function muatPdfMinggu() {
    if (sedangPdf) return;
    const nomborMinggu = minggu || kumpulanMinggu[0]?.minggu || 1;
    const kumpul = kumpulanMinggu.find((item) => item.minggu === nomborMinggu);
    const ids = (kumpul?.item.map((item) => item.id) ?? borang.map((item) => item.id ?? "")).filter(Boolean);
    if (!ids.length) {
      toast.error("Tiada sesi RPH pada minggu ini.");
      return;
    }
    setSedangPdf(true);
    try {
      await muatTurunPdfMinggu({
        ids,
        minggu: nomborMinggu,
        tarikh_mula: kumpul?.tarikh_mula,
        tarikh_tamat: kumpul?.tarikh_tamat,
      });
      toast.success(`PDF RPH Minggu ${nomborMinggu} dimuat turun.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat turun PDF RPH.");
    } finally {
      setSedangPdf(false);
    }
  }

  if (sedangMuat) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Memuatkan semua RPH minggu ini...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/rph">
              <ArrowLeft />
              Kembali
            </Link>
          </Button>
          <div>
            <h1 className="font-heading text-lg font-semibold tracking-tight">
              Minggu {minggu || kumpulanMinggu[0]?.minggu || "?"}
            </h1>
            <p className="text-sm text-muted-foreground">{borang.length} sesi · kemaskini semua sekali gus</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TapisMingguRph
            kumpulan={kumpulanMinggu}
            nilai={minggu || kumpulanMinggu[0]?.minggu || "semua"}
            onChange={(pilih) => {
              if (pilih === "semua") return;
              const kumpul = kumpulanMinggu.find((item) => item.minggu === pilih);
              if (!kumpul) return;
              router.push(`/rph/minggu?minggu=${pilih}&ids=${kumpul.item.map((item) => item.id).join(",")}`);
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void muatPdfMinggu()}
            disabled={sedangPdf || !borang.length}
          >
            {sedangPdf ? <Loader2 className="animate-spin" /> : <Download />}
            Download RPH
          </Button>
          <ButangKongsiRph
            minggu={minggu || kumpulanMinggu[0]?.minggu || 0}
            disabled={!borang.length || !(minggu || kumpulanMinggu[0]?.minggu)}
          />
          <Button type="button" onClick={() => void simpanSemua()} disabled={sedangSimpan || !borang.length}>
            {sedangSimpan ? <Loader2 className="animate-spin" /> : null}
            Simpan
          </Button>
        </div>
      </div>
      {borang.length ? (
        borang.map((item, indeks) => (
          <section key={item.id ?? `sesi-${indeks}`} className="space-y-2" id={`sesi-${indeks + 1}`}>
            <h2 className="font-heading text-sm font-medium">
              Sesi {indeks + 1} / {borang.length}
              {item.hari ? ` · ${item.hari}` : ""}
              {item.masa ? ` · ${item.masa}` : ""}
              {item.mata_pelajaran ? ` · ${item.mata_pelajaran}` : ""}
              {item.kelas ? ` · ${item.kelas}` : ""}
            </h2>
            <JadualRph borang={item} onChange={(nilai) => kemaskini(indeks, nilai)} />
          </section>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">
          Tiada rekod RPH untuk minggu ini.{" "}
          <Link href="/rph" className="underline">
            Kembali ke senarai
          </Link>
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void muatPdfMinggu()}
          disabled={sedangPdf || !borang.length}
        >
          {sedangPdf ? <Loader2 className="animate-spin" /> : <Download />}
          Download RPH
        </Button>
        <ButangKongsiRph
          minggu={minggu || kumpulanMinggu[0]?.minggu || 0}
          disabled={!borang.length || !(minggu || kumpulanMinggu[0]?.minggu)}
        />
        <Button type="button" onClick={() => void simpanSemua()} disabled={sedangSimpan}>
          {sedangSimpan ? <Loader2 className="animate-spin" /> : null}
          Simpan
        </Button>
      </div>
    </div>
  );
}
