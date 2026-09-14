"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HARI_LIST } from "@/lib/jadual/parse";
import type { SesiPdp } from "@/lib/jadual/types";
import type { RphRekod } from "@/lib/rph/types";

export function SenaraiRph() {
  const [sesi, setSesi] = useState<SesiPdp[]>([]);
  const [rph, setRph] = useState<RphRekod[]>([]);
  const [sedangMuat, setSedangMuat] = useState(true);

  useEffect(() => {
    let hidup = true;
    Promise.all([fetch("/api/jadual"), fetch("/api/rph")])
      .then(async ([jadualRes, rphRes]) => {
        const jadualJson = await jadualRes.json();
        const rphJson = await rphRes.json();
        if (!jadualRes.ok) throw new Error(jadualJson.ralat ?? "Gagal memuatkan jadual.");
        if (!rphRes.ok) throw new Error(rphJson.ralat ?? "Gagal memuatkan RPH.");
        if (!hidup) return;
        setSesi(jadualJson.sesi ?? []);
        setRph(rphJson.rph ?? []);
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

  if (sedangMuat) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Memuatkan sesi PdP...
      </p>
    );
  }

  return (
    <div className="space-y-6">
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

      {rph.length ? (
        <div>
          <h2 className="mb-3 font-heading text-lg font-medium">RPH tersimpan</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {rph.map((item) => (
              <Link key={item.id} href={`/rph/${item.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {item.mata_pelajaran} · {item.kelas}
                    </CardTitle>
                    <CardDescription>
                      {[item.tarikh, item.hari, item.masa].filter(Boolean).join(" · ")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {item.sk_tajuk ? <Badge variant="secondary">{item.sk_tajuk}</Badge> : null}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
