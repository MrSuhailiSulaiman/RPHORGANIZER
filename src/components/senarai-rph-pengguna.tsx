"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, ClipboardList, Download, LayoutList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TapisMingguRph } from "@/components/tapis-minggu-rph";
import type { RekodPengguna } from "@/lib/auth/pengguna";
import { muatTurunPdfMinggu } from "@/lib/rph/muat-pdf";
import { kumpulanMingguRph, mingguSemasaDalam } from "@/lib/rph/tahun";
import type { RphRekod } from "@/lib/rph/types";

export function SenaraiRphPengguna({ penggunaId }: { penggunaId: string }) {
  const [pengguna, setPengguna] = useState<RekodPengguna | null>(null);
  const [rph, setRph] = useState<RphRekod[]>([]);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [mingguTapis, setMingguTapis] = useState<number | "semua" | null>(null);
  const [sedangPdf, setSedangPdf] = useState<number | null>(null);

  useEffect(() => {
    let hidup = true;
    fetch(`/api/pengguna/${penggunaId}?t=${Date.now()}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.ralat ?? "Gagal memuatkan RPH pengguna.");
        if (!hidup) return;
        setPengguna(json.pengguna as RekodPengguna);
        setRph((json.rph ?? []) as RphRekod[]);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal memuatkan."))
      .finally(() => {
        if (hidup) setSedangMuat(false);
      });
    return () => {
      hidup = false;
    };
  }, [penggunaId]);

  const kumpulanMinggu = useMemo(() => kumpulanMingguRph(rph), [rph]);
  const mingguLalai = mingguSemasaDalam(kumpulanMinggu) ?? "semua";
  const mingguAktif =
    mingguTapis === "semua" ||
    (typeof mingguTapis === "number" && kumpulanMinggu.some((kumpul) => kumpul.minggu === mingguTapis))
      ? mingguTapis
      : mingguLalai;
  const kumpulanDipapar =
    mingguAktif === "semua"
      ? kumpulanMinggu
      : kumpulanMinggu.filter((kumpul) => kumpul.minggu === mingguAktif);

  async function muatPdfMinggu(kumpul: (typeof kumpulanMinggu)[number]) {
    if (sedangPdf != null) return;
    const ids = kumpul.item.map((item) => item.id).filter(Boolean);
    if (!ids.length) return;
    setSedangPdf(kumpul.minggu);
    try {
      await muatTurunPdfMinggu({
        ids,
        minggu: kumpul.minggu,
        tarikh_mula: kumpul.tarikh_mula,
        tarikh_tamat: kumpul.tarikh_tamat,
        penggunaId,
      });
      toast.success(`PDF RPH Minggu ${kumpul.minggu} dimuat turun.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat turun PDF RPH.");
    } finally {
      setSedangPdf(null);
    }
  }

  if (sedangMuat) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Memuatkan RPH pengguna...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button asChild variant="outline" size="sm" className="mb-3">
            <Link href="/pengguna">
              <ArrowLeft />
              Senarai pengguna
            </Link>
          </Button>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            RPH {pengguna?.nama_pengguna ?? "pengguna"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Semak RPH yang dihasilkan oleh pengguna ini. Paparan untuk lihat sahaja.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={pengguna?.peranan === "admin" ? "default" : "secondary"}>
            {pengguna?.peranan === "admin" ? "Admin" : "Pengguna"}
          </Badge>
          <Button asChild variant="outline" size="sm">
            <Link href={`/pengguna/${penggunaId}/jadual`}>
              <CalendarClock />
              Jadual waktu
            </Link>
          </Button>
        </div>
      </div>

      {kumpulanMinggu.length ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-medium">RPH mengikut minggu</h2>
            <TapisMingguRph
              kumpulan={kumpulanMinggu}
              nilai={mingguAktif}
              termasukSemua
              onChange={setMingguTapis}
            />
          </div>
          {kumpulanDipapar.length ? (
            kumpulanDipapar.map((kumpul) => {
              const idMinggu = kumpul.item.map((item) => item.id);
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
                          <Link
                            href={`/pengguna/${penggunaId}/minggu?minggu=${kumpul.minggu}&ids=${idMinggu.join(",")}`}
                          >
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
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    {kumpul.item.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
                      >
                        <Link
                          href={`/pengguna/${penggunaId}/rph/${item.id}`}
                          className="min-w-0 flex-1 hover:underline"
                        >
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
                        {(item.sk_kod || item.sk_tajuk) ? (
                          <Badge variant="secondary">
                            {item.sk_tajuk?.startsWith(item.sk_kod ?? "")
                              ? item.sk_tajuk
                              : [item.sk_kod, item.sk_tajuk].filter(Boolean).join(" ")}
                          </Badge>
                        ) : null}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Tiada RPH untuk minggu yang dipilih.
            </p>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <ClipboardList className="mb-3 size-10 text-muted-foreground" />
            <h2 className="font-heading text-lg font-medium">Belum ada RPH</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Pengguna ini belum menghasilkan sebarang RPH.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
