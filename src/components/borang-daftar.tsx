"use client";

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BorangDaftar({ onSelesai }: { onSelesai?: () => void }) {
  const [sedang, setSedang] = useState(false);

  async function hantar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sedang) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const kata = String(data.get("kata_laluan") ?? "");
    const sahkan = String(data.get("sahkan") ?? "");
    if (kata !== sahkan) {
      toast.error("Kata laluan tidak sepadan.");
      return;
    }
    setSedang(true);
    try {
      const res = await fetch("/api/auth/daftar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama_pengguna: String(data.get("nama_pengguna") ?? ""),
          kata_laluan: kata,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ralat?: string; pengguna?: { nama?: string } };
      if (!res.ok) throw new Error(json.ralat ?? "Gagal mendaftar.");
      form.reset();
      toast.success(
        json.pengguna?.nama
          ? `Pengguna biasa ${json.pengguna.nama} didaftarkan.`
          : "Pengguna biasa didaftarkan."
      );
      onSelesai?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mendaftar.");
    } finally {
      setSedang(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar pengguna biasa</CardTitle>
        <CardDescription>
          Hanya admin boleh daftar akaun. Guru kemudian log masuk dengan nama dan kata laluan ini.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void hantar(event)}>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nama_pengguna">Nama pengguna</Label>
            <Input id="nama_pengguna" name="nama_pengguna" autoComplete="off" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kata_laluan">Kata laluan</Label>
            <Input
              id="kata_laluan"
              name="kata_laluan"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sahkan">Sahkan kata laluan</Label>
            <Input
              id="sahkan"
              name="sahkan"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={sedang}>
              {sedang ? <Loader2 className="animate-spin" /> : <UserPlus />}
              {sedang ? "Mendaftar..." : "Daftar pengguna"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
