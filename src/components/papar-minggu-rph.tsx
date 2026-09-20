"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JadualRph } from "@/components/jadual-rph";
import { dariRekod, muatanSimpan, type BorangRphNilai } from "@/lib/rph/borang";
import { bandingSesiRph } from "@/lib/rph/tahun";
import type { RphRekod } from "@/lib/rph/types";

export function PaparMingguRph() {
  const params = useSearchParams();
  const idsParam = params.get("ids") ?? "";
  const minggu = Number(params.get("minggu") ?? "0");
  const ids = useMemo(
    () => idsParam.split(",").map((id) => id.trim()).filter(Boolean),
    [idsParam]
  );
  const [borang, setBorang] = useState<BorangRphNilai[]>([]);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [sedangSimpan, setSedangSimpan] = useState(false);

  useEffect(() => {
    let hidup = true;
    async function muat() {
      if (!ids.length) {
        setBorang([]);
        setSedangMuat(false);
        return;
      }
      setSedangMuat(true);
      try {
        const res = await fetch(`/api/rph?ids=${encodeURIComponent(ids.join(","))}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.ralat ?? "Gagal memuatkan RPH minggu ini.");
        const rekod = ((json.rph ?? []) as RphRekod[]).sort(bandingSesiRph);
        if (hidup) setBorang(rekod.map(dariRekod));
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
  }, [ids]);

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

  if (sedangMuat) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Memuatkan semua RPH minggu ini...
      </p>
    );
  }

  if (!borang.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Tiada rekod RPH untuk minggu ini.{" "}
        <Link href="/rph" className="underline">
          Kembali ke senarai
        </Link>
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
              Minggu {minggu || "?"}
            </h1>
            <p className="text-sm text-muted-foreground">{borang.length} sesi · kemaskini semua sekali gus</p>
          </div>
        </div>
        <Button type="button" onClick={() => void simpanSemua()} disabled={sedangSimpan}>
          {sedangSimpan ? <Loader2 className="animate-spin" /> : null}
          Simpan
        </Button>
      </div>
      {borang.map((item, indeks) => (
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
      ))}
      <div className="flex justify-end">
        <Button type="button" onClick={() => void simpanSemua()} disabled={sedangSimpan}>
          {sedangSimpan ? <Loader2 className="animate-spin" /> : null}
          Simpan
        </Button>
      </div>
    </div>
  );
}
