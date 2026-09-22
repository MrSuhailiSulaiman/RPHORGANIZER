"use client";

import { JadualRph } from "@/components/jadual-rph";
import { dariRekod } from "@/lib/rph/borang";
import type { RphRekod } from "@/lib/rph/types";

export function PaparMingguKongsi({
  minggu,
  nama,
  tarikh_mula,
  tarikh_tamat,
  rph,
}: {
  minggu: number;
  nama: string;
  tarikh_mula?: string;
  tarikh_tamat?: string;
  rph: RphRekod[];
}) {
  const borang = rph.map(dariRekod);
  const julat =
    tarikh_mula && tarikh_tamat && tarikh_tamat !== tarikh_mula
      ? `${tarikh_mula} — ${tarikh_tamat}`
      : tarikh_mula ?? "";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Paparan RPH</p>
        <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">Minggu {minggu}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {nama.toUpperCase()}
          {julat ? ` · ${julat}` : ""}
          {` · ${borang.length} sesi · lihat sahaja`}
        </p>
      </div>
      {borang.length ? (
        borang.map((item, indeks) => (
          <section key={item.id ?? `sesi-${indeks}`} className="space-y-2">
            <h2 className="font-heading text-sm font-medium">
              Sesi {indeks + 1} / {borang.length}
              {item.hari ? ` · ${item.hari}` : ""}
              {item.masa ? ` · ${item.masa}` : ""}
              {item.mata_pelajaran ? ` · ${item.mata_pelajaran}` : ""}
              {item.kelas ? ` · ${item.kelas}` : ""}
            </h2>
            <JadualRph borang={item} bacaSahaja />
          </section>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">Tiada rekod RPH untuk minggu ini.</p>
      )}
    </div>
  );
}
