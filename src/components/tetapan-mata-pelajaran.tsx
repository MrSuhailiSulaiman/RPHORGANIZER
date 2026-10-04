"use client";

import { useEffect, useState, type FormEvent } from "react";
import { List, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type MataPelajaran = {
  id: string;
  kod: string | null;
  nama: string;
};

export function TetapanMataPelajaran() {
  const [buka, setBuka] = useState(false);
  const [senarai, setSenarai] = useState<MataPelajaran[]>([]);
  const [kod, setKod] = useState("");
  const [nama, setNama] = useState("");
  const [sedangMuat, setSedangMuat] = useState(false);
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [sedangPadam, setSedangPadam] = useState("");
  const [ralat, setRalat] = useState("");

  useEffect(() => {
    if (!buka) return;
    let hidup = true;
    setSedangMuat(true);
    fetch(`/api/mata-pelajaran?t=${Date.now()}`, { cache: "no-store" })
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
  }, [buka]);

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

  async function kemasKini(item: MataPelajaran, kodBaru: string, namaBaru: string) {
    const res = await fetch("/api/mata-pelajaran", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, kod: kodBaru, nama: namaBaru }),
    });
    const json = (await res.json().catch(() => ({}))) as { ralat?: string; mata_pelajaran?: MataPelajaran };
    if (!res.ok || !json.mata_pelajaran) throw new Error(json.ralat ?? "Gagal mengemaskini mata pelajaran.");
    const disimpan = json.mata_pelajaran;
    setSenarai((semasa) =>
      semasa
        .map((row) => (row.id === disimpan.id ? disimpan : row))
        .sort((a, b) => a.nama.localeCompare(b.nama, "ms"))
    );
    toast.success(`${disimpan.kod} dikemas kini sebagai ${disimpan.nama}.`);
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
    <>
      <Button type="button" variant="outline" onClick={() => setBuka(true)}>
        <List />
        SENARAI MATA PELAJARAN
      </Button>
      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-xl">
          <DialogHeader className="pr-8">
            <DialogTitle>Senarai mata pelajaran</DialogTitle>
            <DialogDescription>
              Daftarkan kod pada jadual dan nama penuhnya. Analisis jadual guna senarai ini untuk kenal
              pasti mata pelajaran. Contoh: SK untuk Sains Komputer.
            </DialogDescription>
          </DialogHeader>

          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => void tambah(event)}>
            <Input
              value={kod}
              onChange={(event) => setKod(event.target.value.toUpperCase())}
              placeholder="Kod, contoh SK"
              aria-label="Kod mata pelajaran"
              className="sm:max-w-36"
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

          <div className="min-h-0 flex-1 overflow-y-auto">
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
                    <TableHead className="w-36" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {berkod.map((item) => (
                    <BarisMata
                      key={item.id}
                      item={item}
                      sedangPadam={sedangPadam === item.id}
                      onKemasKini={kemasKini}
                      onPadam={padam}
                    />
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                Belum ada kod. Tambah SK untuk Sains Komputer dan GEO untuk Geografi.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBuka(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BarisMata({
  item,
  sedangPadam,
  onKemasKini,
  onPadam,
}: {
  item: MataPelajaran;
  sedangPadam: boolean;
  onKemasKini: (item: MataPelajaran, kod: string, nama: string) => Promise<void>;
  onPadam: (item: MataPelajaran) => Promise<void>;
}) {
  const [kod, setKod] = useState(item.kod ?? "");
  const [nama, setNama] = useState(item.nama);
  const [sedang, setSedang] = useState(false);
  const berubah =
    kod.trim().toUpperCase() !== (item.kod ?? "").toUpperCase() || nama.trim() !== item.nama;

  useEffect(() => {
    setKod(item.kod ?? "");
    setNama(item.nama);
  }, [item.id, item.kod, item.nama]);

  async function simpan() {
    setSedang(true);
    try {
      await onKemasKini(item, kod, nama);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengemaskini mata pelajaran.");
    } finally {
      setSedang(false);
    }
  }

  return (
    <TableRow>
      <TableCell>
        <Input
          value={kod}
          onChange={(event) => setKod(event.target.value.toUpperCase())}
          aria-label={`Kod ${item.nama}`}
          className="h-8 w-24"
          maxLength={12}
        />
      </TableCell>
      <TableCell>
        <Input
          value={nama}
          onChange={(event) => setNama(event.target.value)}
          aria-label={`Nama ${item.nama}`}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button type="button" size="sm" variant="outline" disabled={!berubah || sedang || sedangPadam} onClick={() => void simpan()}>
            {sedang ? <Loader2 className="animate-spin" /> : null}
            Kemas kini
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Padam ${item.nama}`}
            disabled={sedangPadam || sedang}
            onClick={() => void onPadam(item)}
          >
            {sedangPadam ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
