"use client";

import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HARI_LIST } from "@/lib/jadual/types";
import type { SesiPdp } from "@/lib/jadual/types";

export function PaparJadualSesi({
  sesi,
  namaFail,
}: {
  sesi: SesiPdp[];
  namaFail?: string | null;
}) {
  const kumpulan = useMemo(
    () =>
      HARI_LIST.map((hari) => ({
        hari,
        item: sesi.filter((row) => row.hari === hari),
      })).filter((kumpul) => kumpul.item.length),
    [sesi]
  );

  if (!sesi.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-16 text-center">
          <CalendarClock className="mb-3 size-10 text-muted-foreground" />
          <h2 className="font-heading text-lg font-medium">Belum ada jadual waktu</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Pengguna ini belum menetapkan jadual waktu.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sesi PdP</CardTitle>
        <CardDescription>
          {sesi.length} sesi
          {namaFail ? ` · ${namaFail}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kumpulan.map((kumpul) => (
          <div key={kumpul.hari} className="rounded-xl border bg-muted/30 p-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">{kumpul.hari}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {kumpul.item.map((item, index) => (
                <li key={item.id ?? `${item.kelas}-${item.masa}-${index}`}>
                  <span className="font-medium">{item.masa}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {item.kelas}
                    {item.tingkatan ? ` · ${item.tingkatan}` : ""} · {item.mata_pelajaran}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
