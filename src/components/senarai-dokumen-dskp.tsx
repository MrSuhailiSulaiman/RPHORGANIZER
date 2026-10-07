"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type DokumenRingkasPaparan = {
  id: string;
  mata_pelajaran: string | null;
  tingkatan: string | null;
  bil_bidang: number;
  bil_sk: number;
  bil_sp: number;
  tahun_terbitan: string | null;
};

export function SenaraiDokumenDskp({ dokumen }: { dokumen: DokumenRingkasPaparan[] }) {
  const [mata, setMata] = useState("semua");
  const pilihan = useMemo(() => {
    return [...new Set(dokumen.map((item) => (item.mata_pelajaran ?? "").trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "ms")
    );
  }, [dokumen]);
  const nampak = mata === "semua" ? dokumen : dokumen.filter((item) => (item.mata_pelajaran ?? "").trim() === mata);

  return (
    <div className="space-y-4">
      <Label className="font-normal text-muted-foreground">
        Tapis mata pelajaran
        <select
          aria-label="Tapis dokumen DSKP mengikut mata pelajaran"
          className="h-8 min-w-[16rem] rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          value={mata}
          onChange={(event) => setMata(event.target.value)}
        >
          <option value="semua">Semua mata pelajaran</option>
          {pilihan.map((nama) => (
            <option key={nama} value={nama}>
              {nama}
            </option>
          ))}
        </select>
      </Label>
      {nampak.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Tiada dokumen DSKP untuk mata pelajaran ini.
        </p>
      ) : (
        <>
          <ul className="divide-y overflow-hidden rounded-lg border bg-card md:hidden">
            {nampak.map((item) => (
              <li key={item.id}>
                <Link href={`/dskp/${item.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.mata_pelajaran ?? "DSKP"}</span>
                    <span className="block text-xs text-muted-foreground">{item.tingkatan || "—"}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {item.bil_bidang} bidang
                    <span className="block">
                      {item.bil_sk} SK · {item.bil_sp} SP
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4 text-xs font-medium text-muted-foreground">Mata pelajaran</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Tingkatan</TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">Bidang</TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">SK</TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">SP</TableHead>
                  <TableHead className="pr-4 text-right text-xs font-medium text-muted-foreground">Tahun</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nampak.map((item) => (
                  <TableRow key={item.id} className="relative">
                    <TableCell className="pl-4 font-medium">
                      <Link href={`/dskp/${item.id}`} className="after:absolute after:inset-0">
                        {item.mata_pelajaran ?? "DSKP"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.tingkatan || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.bil_bidang}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.bil_sk}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.bil_sp}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums text-muted-foreground">
                      {item.tahun_terbitan || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
