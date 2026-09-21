"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JadualRph } from "@/components/jadual-rph";
import { dariRekod, type BorangRphNilai } from "@/lib/rph/borang";
import type { RphRekod } from "@/lib/rph/types";

export function LihatRphPengguna({
  penggunaId,
  rphId,
}: {
  penggunaId: string;
  rphId: string;
}) {
  const [nama, setNama] = useState("");
  const [borang, setBorang] = useState<BorangRphNilai | null>(null);
  const [sedangMuat, setSedangMuat] = useState(true);

  useEffect(() => {
    let hidup = true;
    fetch(`/api/pengguna/${penggunaId}?ids=${encodeURIComponent(rphId)}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.ralat ?? "RPH tidak dijumpai.");
        const rekod = ((json.rph ?? []) as RphRekod[])[0];
        if (!rekod) throw new Error("RPH tidak dijumpai.");
        if (!hidup) return;
        setNama(String(json.pengguna?.nama_pengguna ?? ""));
        setBorang(dariRekod(rekod));
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal memuatkan RPH."))
      .finally(() => {
        if (hidup) setSedangMuat(false);
      });
    return () => {
      hidup = false;
    };
  }, [penggunaId, rphId]);

  if (sedangMuat) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Memuatkan RPH...
      </p>
    );
  }

  if (!borang) {
    return (
      <p className="text-sm text-muted-foreground">
        RPH tidak dijumpai.{" "}
        <Link href={`/pengguna/${penggunaId}`} className="underline">
          Kembali ke senarai
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="outline" size="sm" className="mb-3">
          <Link href={`/pengguna/${penggunaId}`}>
            <ArrowLeft />
            RPH pengguna
          </Link>
        </Button>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          RPH {nama || "pengguna"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Paparan untuk lihat sahaja.</p>
      </div>
      <fieldset disabled className="min-w-0">
        <JadualRph borang={borang} onChange={() => undefined} />
      </fieldset>
    </div>
  );
}
