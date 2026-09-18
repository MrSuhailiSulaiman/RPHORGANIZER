"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { BorangPadamRph } from "@/components/borang-padam-rph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HARI_LIST } from "@/lib/jadual/parse";
import type { SesiPdp } from "@/lib/jadual/types";
import type { RphRekod } from "@/lib/rph/types";
import { isninPadaAtauSelepas, mingguDari, tarikhMulaTahunAsal } from "@/lib/rph/tahun";

export function SenaraiRph({ padamBerjaya = false }: { padamBerjaya?: boolean }) {
  const [sesi, setSesi] = useState<SesiPdp[]>([]);
  const [rph, setRph] = useState<RphRekod[]>([]);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [sedangJana, setSedangJana] = useState(false);
  const [tarikhMula, setTarikhMula] = useState(tarikhMulaTahunAsal());

  async function muat() {
    const cap = Date.now();
    const [jadualRes, rphRes] = await Promise.all([
      fetch(`/api/jadual?t=${cap}`, { cache: "no-store" }),
      fetch(`/api/rph?t=${cap}`, { cache: "no-store" }),
    ]);
    const jadualJson = await jadualRes.json();
    const rphJson = await rphRes.json();
    if (!jadualRes.ok) throw new Error(jadualJson.ralat ?? "Gagal memuatkan jadual.");
    if (!rphRes.ok) throw new Error(rphJson.ralat ?? "Gagal memuatkan RPH.");
    const senarai = (rphJson.rph ?? []) as RphRekod[];
    setSesi(jadualJson.sesi ?? []);
    setRph(senarai);
    return senarai;
  }

  useEffect(() => {
    let hidup = true;
    if (padamBerjaya) {
      setRph([]);
      toast.success("Semua rekod dalam jadual rph telah dipadam.");
    }
    muat()
      .then((senarai) => {
        if (!hidup) return;
        if (padamBerjaya) setRph([]);
        else setRph(senarai);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal memuatkan."))
      .finally(() => {
        if (hidup) setSedangMuat(false);
      });
    return () => {
      hidup = false;
    };
  }, [padamBerjaya]);

  const kumpulan = useMemo(
    () =>
      HARI_LIST.map((hari) => ({
        hari,
        item: sesi.filter((row) => row.hari === hari),
      })).filter((kumpul) => kumpul.item.length),
    [sesi]
  );

  const kumpulanMinggu = useMemo(() => {
    const adaTarikh = rph.filter((item) => item.tarikh);
    if (!adaTarikh.length) return [];
    const mula = isninPadaAtauSelepas(
      [...adaTarikh].sort((a, b) => String(a.tarikh).localeCompare(String(b.tarikh)))[0].tarikh as string
    );
    const peta = new Map<number, RphRekod[]>();
    for (const item of [...adaTarikh].sort((a, b) => String(a.tarikh).localeCompare(String(b.tarikh)))) {
      const minggu = mingguDari(item.tarikh as string, mula);
      const senarai = peta.get(minggu) ?? [];
      senarai.push(item);
      peta.set(minggu, senarai);
    }
    return [...peta.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([minggu, item]) => ({
        minggu,
        tarikh_mula: item[0]?.tarikh,
        tarikh_tamat: item[item.length - 1]?.tarikh,
        item,
      }));
  }, [rph]);

  async function janaRph() {
    if (sedangJana) return;
    if (!sesi.length) {
      toast.error("Tetapkan jadual waktu dahulu.");
      return;
    }
    setSedangJana(true);
    try {
      const res = await fetch("/api/rph/generate", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tarikh_mula: tarikhMula }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ralat?: string;
        bil_rph?: number;
        bil_minggu?: number;
      };
      if (!res.ok) throw new Error(json.ralat ?? "Gagal menjana RPH.");
      await muat();
      toast.success(`${json.bil_rph ?? 0} RPH dijana untuk ${json.bil_minggu ?? 40} minggu.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menjana RPH.");
    } finally {
      setSedangJana(false);
    }
  }

  if (sedangMuat) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Jana RPH setahun</CardTitle>
            <CardDescription>
              Gemini menyusun setiap sesi PdP mengikut urutan DSKP, kemudian menulis objektif, BBM, nilai,
              dan aktiviti untuk 40 minggu persekolahan.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Tarikh mula (Isnin)</span>
              <Input type="date" value={tarikhMula} disabled className="w-44" />
            </label>
            <Button type="button" onClick={() => void janaRph()} disabled={sedangJana}>
              {sedangJana ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {sedangJana ? "Menjana RPH..." : "Generate RPH"}
            </Button>
            <BorangPadamRph />
          </CardContent>
        </Card>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Memuatkan sesi PdP...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Jana RPH setahun</CardTitle>
          <CardDescription>
            Gemini menyusun setiap sesi PdP mengikut urutan DSKP, kemudian menulis objektif, BBM, nilai,
            dan aktiviti untuk 40 minggu persekolahan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Tarikh mula (Isnin)</span>
            <Input
              type="date"
              value={tarikhMula}
              onChange={(event) => setTarikhMula(event.target.value)}
              className="w-44"
            />
          </label>
          <Button type="button" onClick={() => void janaRph()} disabled={sedangJana}>
            {sedangJana ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {sedangJana ? "Menjana RPH..." : "Generate RPH"}
          </Button>
          <BorangPadamRph />
        </CardContent>
      </Card>

      {!rph.length && sesi.length ? (
        <p className="text-sm text-muted-foreground">
          Tiada RPH. Sesi PdP di bawah ialah jadual waktu, bukan rekod RPH.
        </p>
      ) : null}

      {kumpulanMinggu.length ? (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-medium">RPH mengikut minggu</h2>
          {kumpulanMinggu.map((kumpul) => (
            <Card key={kumpul.minggu}>
              <CardHeader>
                <CardTitle>Minggu {kumpul.minggu}</CardTitle>
                <CardDescription>
                  {kumpul.tarikh_mula}
                  {kumpul.tarikh_tamat && kumpul.tarikh_tamat !== kumpul.tarikh_mula
                    ? ` — ${kumpul.tarikh_tamat}`
                    : ""}
                  {` · ${kumpul.item.length} sesi`}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {kumpul.item.map((item) => (
                  <Link
                    key={item.id}
                    href={`/rph/${item.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 hover:bg-muted/40"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {item.mata_pelajaran}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {item.tingkatan ? `${item.tingkatan} ` : ""}
                          {item.kelas}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[item.tarikh, item.hari, item.masa].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {item.sk_kod ? (
                      <Badge variant="secondary">
                        {item.sk_kod} {item.sk_tajuk}
                      </Badge>
                    ) : null}
                  </Link>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {sesi.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <ClipboardList className="mb-3 size-10 text-muted-foreground" />
            <h2 className="font-heading text-lg font-medium">Belum ada sesi PdP</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Tetapkan jadual waktu dahulu. Sesi akan terhasil mengikut kelas, hari, masa, dan mata
              pelajaran.
            </p>
            <Button asChild className="mt-4">
              <Link href="/jadual-waktu">Tetapan jadual waktu</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-medium">Sesi PdP mingguan</h2>
          {kumpulan.map((kumpul) => (
            <Card key={kumpul.hari}>
              <CardHeader>
                <CardTitle>{kumpul.hari}</CardTitle>
                <CardDescription>{kumpul.item.length} sesi</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {kumpul.item.map((item) => (
                  <div
                    key={item.id ?? `${item.kelas}-${item.masa}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {item.mata_pelajaran}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {item.tingkatan ? `${item.tingkatan} ` : ""}
                          {item.kelas}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">{item.masa}</p>
                    </div>
                    {item.id ? (
                      <Button asChild size="sm">
                        <Link href={`/rph/baru?sesi=${item.id}`}>Isi RPH</Link>
                      </Button>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
