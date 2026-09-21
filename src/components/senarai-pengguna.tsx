"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, ClipboardList, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { RekodPenggunaSenarai } from "@/lib/auth/pengguna";

function formatTarikhDaftar(value?: string) {
  if (!value) return "—";
  const tarikh = new Date(value);
  if (Number.isNaN(tarikh.getTime())) return "—";
  return tarikh.toLocaleDateString("ms-MY", { day: "numeric", month: "short", year: "numeric" });
}

export function SenaraiPengguna() {
  const [pengguna, setPengguna] = useState<RekodPenggunaSenarai[]>([]);
  const [sedangMuat, setSedangMuat] = useState(true);

  useEffect(() => {
    let hidup = true;
    fetch(`/api/pengguna?t=${Date.now()}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.ralat ?? "Gagal memuatkan senarai pengguna.");
        if (hidup) setPengguna((json.pengguna ?? []) as RekodPenggunaSenarai[]);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal memuatkan."))
      .finally(() => {
        if (hidup) setSedangMuat(false);
      });
    return () => {
      hidup = false;
    };
  }, []);

  if (sedangMuat) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Memuatkan senarai pengguna...
      </p>
    );
  }

  if (!pengguna.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-16 text-center">
          <Users className="mb-3 size-10 text-muted-foreground" />
          <h2 className="font-heading text-lg font-medium">Tiada pengguna</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Guru yang mendaftar akan dipaparkan di sini.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {pengguna.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{item.nama_pengguna}</p>
              <Badge variant={item.peranan === "admin" ? "default" : "secondary"}>
                {item.peranan === "admin" ? "Admin" : "Pengguna Biasa"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {item.bil_sesi} sesi · {item.bil_rph} RPH
              {item.created_at ? ` · Daftar ${formatTarikhDaftar(item.created_at)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/pengguna/${item.id}/jadual`}>
                <CalendarClock />
                Lihat jadual
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/pengguna/${item.id}`}>
                <ClipboardList />
                Lihat RPH
              </Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
