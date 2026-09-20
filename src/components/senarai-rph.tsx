"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Download, LayoutList, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HARI_LIST } from "@/lib/jadual/parse";
import type { SesiPdp } from "@/lib/jadual/types";
import type { RphRekod } from "@/lib/rph/types";
import { kumpulanMingguRph, tarikhMulaTahunAsal } from "@/lib/rph/tahun";
import { hantarPadamRph, hantarPadamSemuaRph } from "@/lib/rph/padam-pelayar";
import { muatTurunPdfMinggu } from "@/lib/rph/muat-pdf";

export function SenaraiRph() {
  const [sesi, setSesi] = useState<SesiPdp[]>([]);
  const [rph, setRph] = useState<RphRekod[]>([]);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [sedangJana, setSedangJana] = useState(false);
  const [padamId, setPadamId] = useState<string | null>(null);
  const [dipilih, setDipilih] = useState<string[]>([]);
  const [sedangPukal, setSedangPukal] = useState(false);
  const [sedangPdf, setSedangPdf] = useState<number | null>(null);
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
    muat()
      .then((senarai) => {
        if (!hidup) return;
        setRph(senarai);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal memuatkan."))
      .finally(() => {
        if (hidup) setSedangMuat(false);
      });
    return () => {
      hidup = false;
    };
  }, []);

  const kumpulan = useMemo(
    () =>
      HARI_LIST.map((hari) => ({
        hari,
        item: sesi.filter((row) => row.hari === hari),
      })).filter((kumpul) => kumpul.item.length),
    [sesi]
  );

  const kumpulanMinggu = useMemo(() => kumpulanMingguRph(rph), [rph]);

  async function padamRph(id: string) {
    if (padamId === id || sedangPukal) return;
    setPadamId(id);
    setRph((senarai) => senarai.filter((item) => item.id !== id));
    setDipilih((senarai) => senarai.filter((item) => item !== id));
    try {
      await hantarPadamRph([id]);
      toast.success("Rekod RPH dipadam.");
      void muat().catch(() => undefined);
    } catch (error) {
      await muat().catch(() => undefined);
      toast.error(error instanceof Error ? error.message : "Gagal memadam RPH.");
    } finally {
      setPadamId(null);
    }
  }

  function togolDipilih(id: string) {
    setDipilih((senarai) => (senarai.includes(id) ? senarai.filter((item) => item !== id) : [...senarai, id]));
  }

  function togolSemua(ids: string[], pilih: boolean) {
    setDipilih((senarai) => {
      if (pilih) return [...new Set([...senarai, ...ids])];
      const buang = new Set(ids);
      return senarai.filter((id) => !buang.has(id));
    });
  }

  async function padamPukal() {
    if (!dipilih.length || sedangPukal || padamId) return;
    const sasaran = [...dipilih];
    const padamSemua = sasaran.length === rph.length;
    setSedangPukal(true);
    try {
      const bil = padamSemua ? await hantarPadamSemuaRph() : await hantarPadamRph(sasaran);
      const buang = new Set(sasaran);
      setRph((senarai) => (padamSemua ? [] : senarai.filter((item) => !buang.has(item.id))));
      setDipilih([]);
      toast.success(`${bil} rekod RPH dipadam.`);
      void muat().catch(() => undefined);
    } catch (error) {
      await muat().catch(() => undefined);
      toast.error(error instanceof Error ? error.message : "Gagal memadam RPH.");
    } finally {
      setSedangPukal(false);
    }
  }

  async function muatPdfMinggu(kumpul: {
    minggu: number;
    tarikh_mula?: string | null;
    tarikh_tamat?: string | null;
    item: RphRekod[];
  }) {
    if (sedangPdf != null) return;
    const ids = kumpul.item.map((item) => item.id).filter(Boolean);
    if (!ids.length) {
      toast.error("Tiada sesi RPH pada minggu ini.");
      return;
    }
    setSedangPdf(kumpul.minggu);
    try {
      await muatTurunPdfMinggu({
        ids,
        minggu: kumpul.minggu,
        tarikh_mula: kumpul.tarikh_mula,
        tarikh_tamat: kumpul.tarikh_tamat,
      });
      toast.success(`PDF RPH Minggu ${kumpul.minggu} dimuat turun.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat turun PDF RPH.");
    } finally {
      setSedangPdf(null);
    }
  }

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
          </CardContent>
        </Card>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Memuatkan sesi PdP...
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      {sedangPukal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <p className="flex items-center gap-3 rounded-lg border bg-card px-5 py-4 text-sm shadow-lg">
            <Loader2 className="size-5 animate-spin" />
            Memadam RPH... Sila tunggu sehingga selesai.
          </p>
        </div>
      ) : null}
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
          <Button type="button" onClick={() => void janaRph()} disabled={sedangJana || sedangPukal}>
            {sedangJana ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {sedangJana ? "Menjana RPH..." : "Generate RPH"}
          </Button>
        </CardContent>
      </Card>

      {!rph.length && sesi.length ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          Tiada rekod dalam jadual rph. Senarai di bawah ialah <strong>jadual waktu (Sesi PdP)</strong>
          , bukan RPH.
        </p>
      ) : null}

      {kumpulanMinggu.length ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-medium">RPH mengikut minggu</h2>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  disabled={sedangPukal}
                  checked={Boolean(rph.length) && dipilih.length === rph.length}
                  onChange={(event) => togolSemua(rph.map((item) => item.id), event.target.checked)}
                />
                Pilih semua
              </label>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={!dipilih.length || sedangPukal || Boolean(padamId)}
                onClick={() => void padamPukal()}
              >
                {sedangPukal ? <Loader2 className="animate-spin" /> : <Trash2 />}
                {sedangPukal
                  ? "Memadam..."
                  : dipilih.length
                    ? `Padam ${dipilih.length} rekod`
                    : "Padam dipilih"}
              </Button>
            </div>
          </div>
          {kumpulanMinggu.map((kumpul) => {
            const idMinggu = kumpul.item.map((item) => item.id);
            const bilDipilih = idMinggu.filter((id) => dipilih.includes(id)).length;
            return (
            <Card key={kumpul.minggu}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Minggu {kumpul.minggu}</CardTitle>
                    <CardDescription>
                      {kumpul.tarikh_mula}
                      {kumpul.tarikh_tamat && kumpul.tarikh_tamat !== kumpul.tarikh_mula
                        ? ` — ${kumpul.tarikh_tamat}`
                        : ""}
                      {` · ${kumpul.item.length} sesi`}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/rph/minggu?minggu=${kumpul.minggu}&ids=${idMinggu.join(",")}`}>
                        <LayoutList />
                        Papar semua
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={sedangPdf != null || !idMinggu.length}
                      onClick={() => void muatPdfMinggu(kumpul)}
                    >
                      {sedangPdf === kumpul.minggu ? <Loader2 className="animate-spin" /> : <Download />}
                      Download RPH
                    </Button>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        disabled={sedangPukal}
                        checked={idMinggu.length > 0 && bilDipilih === idMinggu.length}
                        onChange={(event) => togolSemua(idMinggu, event.target.checked)}
                      />
                      Pilih minggu
                    </label>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2">
                {kumpul.item.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 accent-primary"
                        disabled={sedangPukal}
                        checked={dipilih.includes(item.id)}
                        onChange={() => togolDipilih(item.id)}
                        aria-label={`Pilih ${item.mata_pelajaran} ${item.tarikh ?? ""}`}
                      />
                      <Link href={`/rph/${item.id}`} className="min-w-0 flex-1 hover:underline">
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
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.sk_kod ? (
                        <Badge variant="secondary">
                          {item.sk_kod} {item.sk_tajuk}
                        </Badge>
                      ) : null}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={padamId === item.id || sedangPukal}
                        onClick={() => void padamRph(item.id)}
                      >
                        {padamId === item.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                        Padam
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            );
          })}
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
          <h2 className="font-heading text-lg font-medium">Jadual waktu (Sesi PdP)</h2>
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
