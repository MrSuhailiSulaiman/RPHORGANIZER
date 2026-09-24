"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type MataPelajaran = {
  id: string;
  kod: string | null;
  nama: string;
};

export function TetapanMataPelajaran() {
  const [senarai, setSenarai] = useState<MataPelajaran[]>([]);
  const [kod, setKod] = useState("");
  const [nama, setNama] = useState("");
  const [sedangMuat, setSedangMuat] = useState(true);
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [sedangPadam, setSedangPadam] = useState("");
  const [ralat, setRalat] = useState("");

  useEffect(() => {
    let hidup = true;
    fetch("/api/mata-pelajaran")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.ralat ?? "Gagal memuatkan mata pelajaran.");
        if (!hidup) return;
        setRalat(typeof json.ralat === "string" ? json.ralat : "");
        setSenarai(json.mata_pelajaran ?? []);
      })
      .catch((error) => {
        const mesej = error instanceof Error ? error.message : "Gagal memuatkan mata pelajaran.";
        if (hidup) setRalat(mesej);
        toast.error(mesej);
      })
      .finally(() => {
        if (hidup) setSedangMuat(false);
      });
    return () => {
      hidup = false;
    };
  }, []);

  async function tambah(event: FormEvent) {
    event.preventDefault();
    setSedangSimpan(true);
    try {
      const res = await fetch("/api/mata-pelajaran", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kod, nama }),
      });
      const json = (await res.json().catch(() => ({}))) as { ralat?: string; mata_pelajaran?: MataPelajaran };
      if (!res.ok || !json.mata_pelajaran) throw new Error(json.ralat ?? "Gagal menyimpan mata pelajaran.");
      const disimpan = json.mata_pelajaran;
      setSenarai((semasa) => {
        const tanpa = semasa.filter((item) => item.id !== disimpan.id);
        return [...tanpa, disimpan].sort((a, b) => a.nama.localeCompare(b.nama, "ms"));
      });
      setKod("");
      setNama("");
      toast.success(`${disimpan.kod} disimpan sebagai ${disimpan.nama}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan mata pelajaran.");
    } finally {
      setSedangSimpan(false);
    }
  }

  async function padam(item: MataPelajaran) {
    setSedangPadam(item.id);
    try {
      const res = await fetch("/api/mata-pelajaran", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const json = (await res.json().catch(() => ({}))) as { ralat?: string };
      if (!res.ok) throw new Error(json.ralat ?? "Gagal memadam mata pelajaran.");
      setSenarai((semasa) => semasa.filter((row) => row.id !== item.id));
      toast.success(`${item.nama} dipadam.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memadam mata pelajaran.");
    } finally {
      setSedangPadam("");
    }
  }

  const berkod = senarai.filter((item) => item.kod?.trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mata pelajaran</CardTitle>
        <CardDescription>
          Daftarkan kod yang tertulis pada jadual dan nama penuhnya. Analisis jadual akan guna senarai
          ini untuk kenal pasti mata pelajaran yang diajar. Contoh: SK untuk Sains Komputer, GEO untuk
          Geografi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => void tambah(event)}>
          <Input
            value={kod}
            onChange={(event) => setKod(event.target.value.toUpperCase())}
            placeholder="Kod, contoh SK"
            aria-label="Kod mata pelajaran"
            className="sm:max-w-40"
            maxLength={12}
            required
          />
          <Input
            value={nama}
            onChange={(event) => setNama(event.target.value)}
            placeholder="Nama, contoh Sains Komputer"
            aria-label="Nama mata pelajaran"
            required
          />
          <Button type="submit" disabled={sedangSimpan}>
            {sedangSimpan ? <Loader2 className="animate-spin" /> : <Plus />}
            Tambah
          </Button>
        </form>

        {ralat ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {ralat}
          </p>
        ) : null}

        {sedangMuat ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Memuatkan mata pelajaran…
          </p>
        ) : berkod.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Kod</TableHead>
                <TableHead>Mata pelajaran</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {berkod.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.kod}</TableCell>
                  <TableCell>{item.nama}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Padam ${item.nama}`}
                      disabled={sedangPadam === item.id}
                      onClick={() => void padam(item)}
                    >
                      {sedangPadam === item.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            Belum ada kod. Tambah SK untuk Sains Komputer dan GEO untuk Geografi.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
