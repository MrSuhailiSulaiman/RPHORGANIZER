"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function nomborTingkatan(nilai: string) {
  return nilai.match(/[1-6]/)?.[0] ?? "";
}

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
  const router = useRouter();
  const [mata, setMata] = useState("semua");
  const [tahap, setTahap] = useState("semua");
  const pilihanMata = useMemo(() => {
    return [...new Set(dokumen.map((item) => (item.mata_pelajaran ?? "").trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "ms")
    );
  }, [dokumen]);
  const pilihanTahap = useMemo(() => {
    const sumber = mata === "semua" ? dokumen : dokumen.filter((item) => (item.mata_pelajaran ?? "").trim() === mata);
    const unik = new Map<string, string>();
    for (const item of sumber) {
      const label = (item.tingkatan ?? "").trim();
      const nombor = nomborTingkatan(label);
      if (!label || !nombor || unik.has(nombor)) continue;
      unik.set(nombor, label);
    }
    return [...unik.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [dokumen, mata]);
  const nampak = dokumen.filter((item) => {
    const mataOk = mata === "semua" || (item.mata_pelajaran ?? "").trim() === mata;
    const tahapOk = tahap === "semua" || nomborTingkatan(item.tingkatan ?? "") === tahap;
    return mataOk && tahapOk;
  });

  function pilihMata(nilai: string) {
    setMata(nilai);
    if (tahap === "semua") return;
    const masihAda =
      nilai === "semua" ||
      dokumen.some(
        (item) => (item.mata_pelajaran ?? "").trim() === nilai && nomborTingkatan(item.tingkatan ?? "") === tahap
      );
    if (!masihAda) setTahap("semua");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Label className="font-normal text-muted-foreground">
          Tapis mata pelajaran
          <select
            aria-label="Tapis dokumen DSKP mengikut mata pelajaran"
            className="h-8 min-w-[16rem] rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            value={mata}
            onChange={(event) => pilihMata(event.target.value)}
          >
            <option value="semua">Semua mata pelajaran</option>
            {pilihanMata.map((nama) => (
              <option key={nama} value={nama}>
                {nama}
              </option>
            ))}
          </select>
        </Label>
        <Label className="font-normal text-muted-foreground">
          Tapis tingkatan
          <select
            aria-label="Tapis dokumen DSKP mengikut tingkatan"
            className="h-8 min-w-[12rem] rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            value={pilihanTahap.some(([nombor]) => nombor === tahap) ? tahap : "semua"}
            onChange={(event) => setTahap(event.target.value)}
          >
            <option value="semua">Semua tingkatan</option>
            {pilihanTahap.map(([nombor, label]) => (
              <option key={nombor} value={nombor}>
                {label}
              </option>
            ))}
          </select>
        </Label>
      </div>
      {nampak.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Tiada dokumen DSKP untuk mata pelajaran dan tingkatan ini.
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
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/dskp/${item.id}`)}
                  >
                    <TableCell className="pl-4 font-medium">
                      <Link href={`/dskp/${item.id}`}>{item.mata_pelajaran ?? "DSKP"}</Link>
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
