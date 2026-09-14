"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, FileUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CONTOH_CSV, HARI_LIST, pecahKelas } from "@/lib/jadual/parse";
import type { SesiPdp } from "@/lib/jadual/types";

const HARI_OPTIONS = [...HARI_LIST];

function sesiKosong(): SesiPdp {
  return {
    kelas: "",
    tingkatan: "",
    hari: "ISNIN",
    masa: "",
    masa_mula: "",
    masa_tamat: "",
    mata_pelajaran: "",
  };
}

export function TetapanJadualWaktu() {
  const [sesi, setSesi] = useState<SesiPdp[]>([]);
  const [namaFail, setNamaFail] = useState("");
  const [sedangBaca, setSedangBaca] = useState(false);
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [sedangMuat, setSedangMuat] = useState(true);

  useEffect(() => {
    let hidup = true;
    fetch("/api/jadual")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.ralat ?? "Gagal memuatkan jadual.");
        if (!hidup) return;
        setSesi(json.sesi ?? []);
        setNamaFail(json.jadual?.nama_fail ?? "");
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal memuatkan jadual."))
      .finally(() => {
        if (hidup) setSedangMuat(false);
      });
    return () => {
      hidup = false;
    };
  }, []);

  const kumpulan = useMemo(() => {
    return HARI_OPTIONS.map((hari) => ({
      hari,
      item: sesi.filter((row) => row.hari === hari),
    })).filter((kumpul) => kumpul.item.length);
  }, [sesi]);

  async function bacaFail(file: File) {
    setSedangBaca(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/jadual/analyze", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.ralat ?? "Gagal membaca fail.");
      setSesi(json.sesi ?? []);
      setNamaFail(file.name);
      toast.success(`${json.sesi.length} sesi PdP dijana daripada jadual.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membaca fail.");
    } finally {
      setSedangBaca(false);
    }
  }

  async function simpan() {
    setSedangSimpan(true);
    try {
      const res = await fetch("/api/jadual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama_fail: namaFail, sesi }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.ralat ?? "Gagal menyimpan.");
      setSesi(json.sesi ?? sesi);
      toast.success("Jadual waktu disimpan. Sesi PdP sedia untuk isi RPH.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan jadual.");
    } finally {
      setSedangSimpan(false);
    }
  }

  function kemaskini(index: number, field: keyof SesiPdp, value: string) {
    setSesi((current) =>
      current.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, [field]: value };
        if (field === "kelas") {
          const pecah = pecahKelas(value);
          next.kelas = pecah.kelas;
          if (pecah.tingkatan) next.tingkatan = pecah.tingkatan;
        }
        if (field === "masa") {
          const match = value.match(/(\d{1,2}[.:]\d{2})\s*-\s*(\d{1,2}[.:]\d{2})/);
          if (match) {
            next.masa_mula = match[1].replace(":", ".");
            next.masa_tamat = match[2].replace(":", ".");
          }
        }
        return next;
      })
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <CalendarClock className="size-4" />
        <AlertTitle>Jadual menjana sesi PdP</AlertTitle>
        <AlertDescription>
          Muat naik jadual dengan lajur <strong>KELAS</strong>, <strong>HARI</strong>,{" "}
          <strong>MASA</strong>, dan <strong>MATA PELAJARAN</strong>. Setiap baris menjadi satu sesi
          yang boleh dibuka sebagai borang RPH.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Muat naik jadual waktu</CardTitle>
          <CardDescription>CSV, Excel (.xlsx) atau PDF. Fail contoh boleh dimuat turun.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center hover:bg-muted/40">
            <FileUp className="mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Letak fail jadual di sini atau pilih fail</p>
            <p className="mt-1 text-xs text-muted-foreground">CSV · XLSX · PDF · maksimum 10 MB</p>
            <input
              type="file"
              accept=".csv,.txt,.xlsx,.xls,.pdf"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void bacaFail(file);
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const blob = new Blob([CONTOH_CSV], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "contoh-jadual-waktu.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Muat turun contoh CSV
            </Button>
            {namaFail ? <Badge variant="secondary">{namaFail}</Badge> : null}
            {sedangBaca ? (
              <Badge variant="outline">
                <Loader2 className="animate-spin" /> Membaca jadual...
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Sesi PdP</CardTitle>
            <CardDescription>
              {sedangMuat ? "Memuatkan..." : `${sesi.length} sesi daripada jadual waktu.`}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setSesi((current) => [...current, sesiKosong()])}>
              <Plus />
              Tambah sesi
            </Button>
            <Button type="button" onClick={() => void simpan()} disabled={!sesi.length || sedangSimpan}>
              {sedangSimpan ? <Loader2 className="animate-spin" /> : null}
              Simpan jadual
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {sesi.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada sesi. Muat naik jadual atau tambah sesi secara manual.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Tingkatan</TableHead>
                  <TableHead>Hari</TableHead>
                  <TableHead>Masa</TableHead>
                  <TableHead>Mata pelajaran</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sesi.map((row, index) => (
                  <TableRow key={`${row.hari}-${row.masa}-${row.kelas}-${index}`}>
                    <TableCell>
                      <Input
                        value={row.kelas}
                        onChange={(event) => kemaskini(index, "kelas", event.target.value)}
                        placeholder="UTM"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.tingkatan}
                        onChange={(event) => kemaskini(index, "tingkatan", event.target.value)}
                        placeholder="Tingkatan 5"
                      />
                    </TableCell>
                    <TableCell>
                      <select
                        value={row.hari}
                        onChange={(event) => kemaskini(index, "hari", event.target.value)}
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                      >
                        {HARI_OPTIONS.map((hari) => (
                          <option key={hari} value={hari}>
                            {hari}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.masa}
                        onChange={(event) => kemaskini(index, "masa", event.target.value)}
                        placeholder="11.40 - 13.00"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.mata_pelajaran}
                        onChange={(event) => kemaskini(index, "mata_pelajaran", event.target.value)}
                        placeholder="SAINS KOMPUTER"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {row.id ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/rph/baru?sesi=${row.id}`}>Isi RPH</Link>
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setSesi((current) => current.filter((_, i) => i !== index))}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {kumpulan.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {kumpulan.map((kumpul) => (
                <div key={kumpul.hari} className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground">{kumpul.hari}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {kumpul.item.map((item, index) => (
                      <li key={`${item.kelas}-${item.masa}-${index}`}>
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
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-sm font-medium">Nama fail rujukan</p>
            <Input id="nama-fail" value={namaFail} onChange={(event) => setNamaFail(event.target.value)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
