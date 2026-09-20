"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BorangDaftar() {
  const router = useRouter();
  const [sedang, setSedang] = useState(false);

  async function hantar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sedang) return;
    const data = new FormData(event.currentTarget);
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
      const json = (await res.json().catch(() => ({}))) as { ralat?: string };
      if (!res.ok) throw new Error(json.ralat ?? "Gagal mendaftar.");
      router.replace("/");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mendaftar.");
      setSedang(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Daftar akaun</CardTitle>
        <CardDescription>Akaun baharu ialah pengguna biasa. Setiap guru hanya nampak RPH sendiri.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(event) => void hantar(event)}>
          <div className="space-y-1.5">
            <Label htmlFor="nama_pengguna">Nama pengguna</Label>
            <Input id="nama_pengguna" name="nama_pengguna" autoComplete="username" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kata_laluan">Kata laluan</Label>
            <Input id="kata_laluan" name="kata_laluan" type="password" autoComplete="new-password" required minLength={6} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sahkan">Sahkan kata laluan</Label>
            <Input id="sahkan" name="sahkan" type="password" autoComplete="new-password" required minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={sedang}>
            {sedang ? <Loader2 className="animate-spin" /> : <UserPlus />}
            {sedang ? "Mendaftar..." : "Daftar"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Sudah ada akaun?{" "}
            <Link href="/masuk" className="underline">
              Log masuk
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
