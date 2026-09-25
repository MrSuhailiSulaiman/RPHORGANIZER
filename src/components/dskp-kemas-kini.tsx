"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { DskpEditor } from "@/components/dskp-editor";
import { DskpTree } from "@/components/dskp-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TINGKATAN } from "@/lib/dskp/maklumat";
import type { BidangPembelajaran } from "@/lib/dskp/types";

async function bacaJson(res: Response) {
  const text = await res.text();
  if (!text) return {} as { ralat?: string; id?: string };
  try {
    return JSON.parse(text) as { ralat?: string; id?: string };
  } catch {
    return { ralat: "Pelayan tidak memulangkan jawapan yang sah." };
  }
}

export function DskpKemasKini({
  id,
  bolehEdit,
  mataPelajaran,
  tingkatan,
  tahunTerbitan,
  namaFail,
  kaedahAnalisis,
  bidang,
}: {
  id: string;
  bolehEdit: boolean;
  mataPelajaran: string;
  tingkatan: string;
  tahunTerbitan: string | null;
  namaFail: string;
  kaedahAnalisis: string | null;
  bidang: BidangPembelajaran[];
}) {
  const router = useRouter();
  const [sedangEdit, setSedangEdit] = useState(false);
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [asal, setAsal] = useState({
    nama: mataPelajaran,
    tahap: tingkatan,
    tahun: tahunTerbitan ?? "",
    kandungan: bidang,
  });
  const [nama, setNama] = useState(mataPelajaran);
  const [tahap, setTahap] = useState(tingkatan);
  const [tahun, setTahun] = useState(tahunTerbitan ?? "");
  const [kandungan, setKandungan] = useState(bidang);

  const bilSk = kandungan.reduce((sum, item) => sum + item.standard_kandungan.length, 0);
  const bilSp = kandungan.reduce(
    (sum, item) => sum + item.standard_kandungan.reduce((inner, sk) => inner + sk.standard_pembelajaran.length, 0),
    0
  );

  function batal() {
    setNama(asal.nama);
    setTahap(asal.tahap);
    setTahun(asal.tahun);
    setKandungan(asal.kandungan);
    setSedangEdit(false);
  }

  async function simpan() {
    setSedangSimpan(true);
    try {
      const res = await fetch(`/api/dskp/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mata_pelajaran: nama,
          tingkatan: tahap,
          tahun_terbitan: tahun.trim() || null,
          bidang: kandungan,
        }),
      });
      const json = await bacaJson(res);
      if (!res.ok) throw new Error(json.ralat ?? "Gagal mengemas kini DSKP.");
      const disimpan = { nama: nama.trim(), tahap: tahap.trim(), tahun: tahun.trim(), kandungan };
      setNama(disimpan.nama);
      setTahap(disimpan.tahap);
      setTahun(disimpan.tahun);
      setAsal(disimpan);
      toast.success("DSKP dikemas kini.");
      setSedangEdit(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengemas kini DSKP.");
    } finally {
      setSedangSimpan(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {nama || "DSKP"} {tahap ? `· ${tahap}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{namaFail}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">{kandungan.length} bidang</Badge>
            <Badge variant="secondary">{bilSk} SK</Badge>
            <Badge variant="secondary">{bilSp} SP</Badge>
            {tahun ? <Badge variant="outline">{tahun}</Badge> : null}
            {kaedahAnalisis ? <Badge variant="outline">{kaedahAnalisis}</Badge> : null}
          </div>
        </div>
        {bolehEdit && !sedangEdit ? (
          <Button type="button" variant="outline" onClick={() => setSedangEdit(true)}>
            <Pencil />
            Edit
          </Button>
        ) : null}
      </div>

      {sedangEdit ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="edit-mata">Mata pelajaran</Label>
              <Input id="edit-mata" value={nama} onChange={(event) => setNama(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tingkatan">Tingkatan</Label>
              <select
                id="edit-tingkatan"
                value={tahap}
                onChange={(event) => setTahap(event.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Pilih tingkatan</option>
                {TINGKATAN.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
                {tahap && !TINGKATAN.includes(tahap as (typeof TINGKATAN)[number]) ? (
                  <option value={tahap}>{tahap}</option>
                ) : null}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tahun">Tahun terbitan</Label>
              <Input id="edit-tahun" value={tahun} onChange={(event) => setTahun(event.target.value)} placeholder="cth. 2024" />
            </div>
          </div>
          <DskpEditor bidang={kandungan} onChange={setKandungan} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void simpan()} disabled={sedangSimpan}>
              {sedangSimpan ? <Loader2 className="animate-spin" /> : null}
              Simpan kemas kini
            </Button>
            <Button type="button" variant="outline" onClick={batal} disabled={sedangSimpan}>
              Batal
            </Button>
          </div>
        </div>
      ) : (
        <DskpTree bidang={kandungan} />
      )}
    </div>
  );
}
