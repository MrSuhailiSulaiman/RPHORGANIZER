"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BorangMasuk() {
  const router = useRouter();
  const search = useSearchParams();
  const [sedang, setSedang] = useState(false);

  async function hantar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sedang) return;
    const data = new FormData(event.currentTarget);
    setSedang(true);
    try {
      const res = await fetch("/api/auth/masuk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama_pengguna: String(data.get("nama_pengguna") ?? ""),
          kata_laluan: String(data.get("kata_laluan") ?? ""),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ralat?: string };
      if (!res.ok) throw new Error(json.ralat ?? "Gagal log masuk.");
      const dari = search.get("dari") || "/";
      router.replace(dari.startsWith("/") ? dari : "/");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal log masuk.");
      setSedang(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Log masuk e-RPH</CardTitle>
        <CardDescription>Daftar akaun baharu atau log masuk untuk menggunakan sistem.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(event) => void hantar(event)}>
          <div className="space-y-1.5">
            <Label htmlFor="nama_pengguna">Nama pengguna</Label>
            <Input id="nama_pengguna" name="nama_pengguna" autoComplete="username" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kata_laluan">Kata laluan</Label>
            <Input id="kata_laluan" name="kata_laluan" type="password" autoComplete="current-password" required />
          </div>
          <Button type="submit" className="w-full" disabled={sedang}>
            {sedang ? <Loader2 className="animate-spin" /> : <LogIn />}
            {sedang ? "Log masuk..." : "Log masuk"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Belum ada akaun?{" "}
            <Link href="/daftar" className="underline">
              Daftar
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
