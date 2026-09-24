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
import { cn } from "@/lib/utils";

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
  const [sedangLepas, setSedangLepas] = useState(false);
  const [ralatBaca, setRalatBaca] = useState("");

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
    setRalatBaca("");
    const kawalan = new AbortController();
    const timer = window.setTimeout(() => kawalan.abort(), 80000);
    try {
      const heic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
      if (heic) {
        throw new Error("Gambar iPhone (HEIC) tidak boleh dibaca. Simpan/kongsi sebagai JPG atau PNG.");
      }

      const ialahGambar =
        file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name);

      let hasil: SesiPdp[] = [];
      if (ialahGambar) {
        const [{ analyzeJadualOcrPelayar }, rujukan] = await Promise.all([
          import("@/lib/jadual/ocr-browser"),
          fetch("/api/mata-pelajaran")
            .then(async (res) => {
              const json = (await res.json().catch(() => ({}))) as {
                mata_pelajaran?: { kod?: string; nama?: string }[];
              };
              return (json.mata_pelajaran ?? []).flatMap((item) => {
                const kod = item.kod?.trim() ?? "";
                const nama = item.nama?.trim() ?? "";
                return kod && nama ? [{ kod, nama }] : [];
              });
            })
            .catch(() => []),
        ]);
        hasil = await analyzeJadualOcrPelayar(file, rujukan);
      } else {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/jadual/analyze", { method: "POST", body: form, signal: kawalan.signal });
        const json = (await res.json().catch(() => ({}))) as { ralat?: string; sesi?: SesiPdp[] };
        if (!res.ok) throw new Error(json.ralat ?? "Gagal membaca fail.");
        hasil = json.sesi ?? [];
      }
      if (!hasil.length) {
        throw new Error("Tiada sesi PdP dijumpai dalam gambar. Pastikan jadual hari dan kelas nampak jelas.");
      }
      setSesi(hasil);
      setNamaFail(file.name);
      toast.success(`${hasil.length} sesi PdP dijana daripada jadual.`);
    } catch (error) {
      const mesej =
        error instanceof DOMException && error.name === "AbortError"
          ? "Bacaan jadual terlalu lama. Cuba gambar JPG yang lebih kecil dan jelas."
          : error instanceof Error
            ? error.message
            : "Gagal membaca fail.";
      setRalatBaca(mesej);
      toast.error(mesej);
    } finally {
      window.clearTimeout(timer);
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
          Muat naik <strong>gambar</strong> jadual guru (JPG/PNG). Sistem menganalisis setiap petak dan
          menjana sesi PdP mengikut <strong>hari</strong>, <strong>masa</strong>, <strong>kelas</strong>,
          dan <strong>mata pelajaran</strong>. PDF, CSV, atau Excel juga diterima.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Muat naik jadual waktu</CardTitle>
          <CardDescription>
            Ambil gambar jadual guru (JPG, PNG, WEBP). Sistem akan baca grid dan pecahkan kepada sesi
            PdP. PDF, CSV, atau Excel juga boleh.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors hover:bg-muted/40",
              sedangLepas && "border-primary bg-muted/50",
              sedangBaca && "pointer-events-none opacity-70"
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setSedangLepas(true);
            }}
            onDragLeave={() => setSedangLepas(false)}
            onDrop={(event) => {
              event.preventDefault();
              setSedangLepas(false);
              const file = event.dataTransfer.files[0];
              if (file) void bacaFail(file);
            }}
          >
            <FileUp className="mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Letak gambar jadual di sini atau pilih fail</p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPG · PNG · WEBP · HEIC · PDF · CSV · XLSX · maksimum 10 MB
            </p>
            <input
              type="file"
              accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif,.pdf,.csv,.txt,.xlsx,.xls"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void bacaFail(file);
              }}
            />
          </label>
          {ralatBaca ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {ralatBaca}
            </p>
          ) : null}
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
