"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaparJadualSesi } from "@/components/lihat-jadual-pengguna";
import type { RekodPengguna } from "@/lib/auth/pengguna";
import type { JadualWaktu, SesiPdp } from "@/lib/jadual/types";

export function JadualPengguna({ penggunaId }: { penggunaId: string }) {
  const [pengguna, setPengguna] = useState<RekodPengguna | null>(null);
  const [jadual, setJadual] = useState<JadualWaktu | null>(null);
  const [sesi, setSesi] = useState<SesiPdp[]>([]);
  const [sedangMuat, setSedangMuat] = useState(true);

  useEffect(() => {
    let hidup = true;
    fetch(`/api/pengguna/${penggunaId}?t=${Date.now()}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.ralat ?? "Gagal memuatkan jadual pengguna.");
        if (!hidup) return;
        setPengguna(json.pengguna as RekodPengguna);
        setJadual((json.jadual ?? null) as JadualWaktu | null);
        setSesi((json.sesi ?? json.jadual?.sesi ?? []) as SesiPdp[]);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal memuatkan."))
      .finally(() => {
        if (hidup) setSedangMuat(false);
      });
    return () => {
      hidup = false;
    };
  }, [penggunaId]);

  if (sedangMuat) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Memuatkan jadual waktu...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button asChild variant="outline" size="sm" className="mb-3">
            <Link href="/pengguna">
              <ArrowLeft />
              Senarai pengguna
            </Link>
          </Button>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Jadual {pengguna?.nama_pengguna ?? "pengguna"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paparan untuk lihat sahaja. Guru lain tidak dapat melihat jadual ini.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={pengguna?.peranan === "admin" ? "default" : "secondary"}>
            {pengguna?.peranan === "admin" ? "Admin" : "Pengguna"}
          </Badge>
          <Button asChild variant="outline" size="sm">
            <Link href={`/pengguna/${penggunaId}`}>
              <ClipboardList />
              Lihat RPH
            </Link>
          </Button>
        </div>
      </div>
      <PaparJadualSesi sesi={sesi} namaFail={jadual?.nama_fail} />
    </div>
  );
}
