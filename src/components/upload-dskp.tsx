"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileUp, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DskpEditor } from "@/components/dskp-editor";
import { DskpTree } from "@/components/dskp-tree";
import { TINGKATAN, sahkanMaklumatDskp } from "@/lib/dskp/maklumat";
import { ringkasanExtract } from "@/lib/dskp/parse";
import type { DskpExtract } from "@/lib/dskp/types";

type Ringkasan = { bilBidang: number; bilSk: number; bilSp: number };

export function UploadDskp({ supabaseSedia }: { supabaseSedia: boolean }) {
  const router = useRouter();
  const [fail, setFail] = useState<File | null>(null);
  const [mataPelajaran, setMataPelajaran] = useState("");
  const [tingkatan, setTingkatan] = useState("");
  const [senaraiMp, setSenaraiMp] = useState<string[]>([]);
  const [extract, setExtract] = useState<DskpExtract | null>(null);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [jumlahMukaSurat, setJumlahMukaSurat] = useState<number | null>(null);
  const [sedangAnalisis, setSedangAnalisis] = useState(false);
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [storagePath, setStoragePath] = useState("");
  const [seret, setSeret] = useState(false);
  const [sedangEdit, setSedangEdit] = useState(false);

  const maklumat = sahkanMaklumatDskp(mataPelajaran, tingkatan);
  const maklumatLengkap = !("ralat" in maklumat);

  useEffect(() => {
    let aktif = true;
    fetch("/api/mata-pelajaran")
      .then((res) => res.json())
      .then((json) => {
        if (!aktif || !Array.isArray(json.mata_pelajaran)) return;
        setSenaraiMp(
          json.mata_pelajaran
            .map((item: { nama?: string }) => item.nama)
            .filter((nama: string | undefined): nama is string => Boolean(nama))
        );
      })
      .catch(() => undefined);
    return () => {
      aktif = false;
    };
  }, []);

  async function bacaJson(res: Response) {
    const teks = await res.text();
    try {
      return JSON.parse(teks) as {
        ralat?: string;
        extract?: DskpExtract;
        ringkasan?: Ringkasan;
        jumlahMukaSurat?: number;
        id?: string;
        path?: string;
        signedUrl?: string;
      };
    } catch {
      throw new Error(
        res.status === 413 || res.status === 504 || res.status === 408 || res.status >= 500
          ? "Analisis tamat masa atau fail terlalu besar. Sila cuba semula."
          : "Permintaan gagal. Sila cuba semula."
      );
    }
  }

  async function muatNaikKeStoran(file: File) {
    const res = await fetch("/api/dskp/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama_fail: file.name, saiz: file.size }),
    });
    const json = await bacaJson(res);
    if (!res.ok || !json.signedUrl || !json.path) {
      throw new Error(json.ralat ?? "Gagal sediakan muat naik PDF.");
    }
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    let put = await fetch(json.signedUrl, { method: "PUT", body: form });
    if (!put.ok) {
      put = await fetch(json.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
    }
    if (!put.ok) {
      throw new Error("Gagal muat naik PDF ke storan.");
    }
    return json.path;
  }

  async function analisis() {
    if (!fail) return;
    if ("ralat" in maklumat) {
      toast.error(maklumat.ralat);
      return;
    }
    setSedangAnalisis(true);
    setExtract(null);
    setStoragePath("");
    setSedangEdit(false);
    try {
      let res: Response;
      let path = storagePath;
      try {
        path = await muatNaikKeStoran(fail);
        setStoragePath(path);
        res = await fetch("/api/dskp/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        });
      } catch (error) {
        if (fail.size > 4 * 1024 * 1024) throw error;
        const form = new FormData();
        form.append("file", fail);
        res = await fetch("/api/dskp/analyze", { method: "POST", body: form });
      }
      const json = await bacaJson(res);
      if (!res.ok) throw new Error(json.ralat ?? "Analisis gagal.");
      if (!json.extract || !json.ringkasan) throw new Error("Hasil analisis tidak lengkap.");
      if (json.path) setStoragePath(json.path);
      setExtract({
        ...json.extract,
        mata_pelajaran: maklumat.nama,
        tingkatan: maklumat.tahap,
      });
      setRingkasan(json.ringkasan);
      setJumlahMukaSurat(json.jumlahMukaSurat ?? null);
      toast.success("PDF DSKP berjaya dianalisis.");
      if (json.extract?.amaran) toast.warning(json.extract.amaran);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analisis gagal.");
    } finally {
      setSedangAnalisis(false);
    }
  }

  async function simpan() {
    if (!fail || !extract) return;
    if ("ralat" in maklumat) {
      toast.error(maklumat.ralat);
      return;
    }
    setSedangSimpan(true);
    try {
      let res: Response;
      const payload = {
        ...extract,
        mata_pelajaran: maklumat.nama,
        tingkatan: maklumat.tahap,
      };
      if (storagePath) {
        res = await fetch("/api/dskp/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: storagePath,
            payload,
            mata_pelajaran: maklumat.nama,
            tingkatan: maklumat.tahap,
            nama_fail: fail.name,
          }),
        });
      } else {
        const form = new FormData();
        form.append("file", fail);
        form.append("mata_pelajaran", maklumat.nama);
        form.append("tingkatan", maklumat.tahap);
        form.append("payload", JSON.stringify(payload));
        res = await fetch("/api/dskp/save", { method: "POST", body: form });
      }
      const json = await bacaJson(res);
      if (!res.ok) throw new Error(json.ralat ?? "Gagal menyimpan.");
      toast.success("DSKP disimpan.");
      router.push(`/dskp/${json.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan.");
    } finally {
      setSedangSimpan(false);
    }
  }

  return (
    <div className="space-y-6">
      {!supabaseSedia ? (
        <Alert>
          <AlertTitle>Supabase belum disambung</AlertTitle>
          <AlertDescription>
            Anda masih boleh menganalisis PDF. Untuk menyimpan ke jadual, isi{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code> dan jalankan{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase/schema.sql</code>.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Muat naik DSKP</CardTitle>
          <CardDescription>
            Isi mata pelajaran dan tingkatan dahulu. PDF kemudian disusun kepada Bidang Pembelajaran,
            Standard Kandungan, dan Standard Pembelajaran.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mata-pelajaran">Mata pelajaran</Label>
              <Input
                id="mata-pelajaran"
                list="senarai-mata-pelajaran"
                required
                value={mataPelajaran}
                onChange={(event) => setMataPelajaran(event.target.value)}
                placeholder="cth. Sains Komputer"
                autoComplete="off"
              />
              <datalist id="senarai-mata-pelajaran">
                {senaraiMp.map((nama) => (
                  <option key={nama} value={nama} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tingkatan">Tingkatan</Label>
              <select
                id="tingkatan"
                required
                value={tingkatan}
                onChange={(event) => setTingkatan(event.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Pilih tingkatan</option>
                {TINGKATAN.map((tahap) => (
                  <option key={tahap} value={tahap}>
                    {tahap}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label
            onDragOver={(event) => {
              event.preventDefault();
              setSeret(true);
            }}
            onDragLeave={() => setSeret(false)}
            onDrop={(event) => {
              event.preventDefault();
              setSeret(false);
              const dropped = event.dataTransfer.files[0];
              if (dropped) {
                setFail(dropped);
                setExtract(null);
                setStoragePath("");
                setSedangEdit(false);
              }
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors ${
              seret ? "border-primary bg-muted" : "border-border hover:bg-muted/40"
            }`}
          >
            <FileUp className="mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Letak PDF di sini atau pilih fail</p>
            <p className="mt-1 text-xs text-muted-foreground">Maksimum 15 MB</p>
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFail(next);
                setExtract(null);
                setStoragePath("");
                setSedangEdit(false);
              }}
            />
          </label>
          {fail ? (
            <p className="text-sm text-muted-foreground">
              Dipilih: <span className="font-medium text-foreground">{fail.name}</span>
            </p>
          ) : null}
          <Button onClick={analisis} disabled={!fail || !maklumatLengkap || sedangAnalisis}>
            {sedangAnalisis ? <Loader2 className="animate-spin" /> : null}
            {sedangAnalisis ? "Menganalisis..." : "Analisis PDF"}
          </Button>
        </CardContent>
      </Card>

      {extract && ringkasan ? (
        <Card>
          <CardHeader>
            <CardTitle>Semakan sebelum simpan</CardTitle>
            <CardDescription>
              {mataPelajaran} · {tingkatan}
              {extract.tahun_terbitan ? ` · ${extract.tahun_terbitan}` : ""}
              {jumlahMukaSurat ? ` · ${jumlahMukaSurat} muka surat` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted px-3 py-3">
                <p className="text-2xl font-semibold">{ringkasan.bilBidang}</p>
                <p className="text-xs text-muted-foreground">Bidang pembelajaran</p>
              </div>
              <div className="rounded-lg bg-muted px-3 py-3">
                <p className="text-2xl font-semibold">{ringkasan.bilSk}</p>
                <p className="text-xs text-muted-foreground">Standard kandungan</p>
              </div>
              <div className="rounded-lg bg-muted px-3 py-3">
                <p className="text-2xl font-semibold">{ringkasan.bilSp}</p>
                <p className="text-xs text-muted-foreground">Standard pembelajaran</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Kaedah: {extract.kaedah_analisis === "ai" ? "Analisis AI" : "Parser DSKP"}
              {sedangEdit ? " · Edit hasil sebelum simpan." : ""}
            </p>
            {sedangEdit ? (
              <DskpEditor
                bidang={extract.bidang}
                onChange={(bidang) => {
                  const seterusnya = { ...extract, bidang };
                  setExtract(seterusnya);
                  setRingkasan(ringkasanExtract(seterusnya));
                }}
              />
            ) : (
              <DskpTree bidang={extract.bidang} />
            )}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSedangEdit((nilai) => !nilai)}
                >
                  <Pencil />
                  {sedangEdit ? "Selesai edit" : "Edit"}
                </Button>
                <Button onClick={simpan} disabled={!maklumatLengkap || sedangSimpan}>
                  {sedangSimpan ? <Loader2 className="animate-spin" /> : null}
                  Simpan DSKP
                </Button>
              </div>
              {!maklumatLengkap ? (
                <p className="text-sm text-destructive">Isi mata pelajaran dan tingkatan di atas sebelum simpan.</p>
              ) : null}
              {!supabaseSedia ? (
                <p className="text-sm text-muted-foreground">
                  Jika simpan gagal, jalankan <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase/schema.sql</code>{" "}
                  dan mulakan semula <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run dev</code>.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
