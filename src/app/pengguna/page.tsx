import { redirect } from "next/navigation";
import { SenaraiPengguna } from "@/components/senarai-pengguna";
import { sesiSemasa } from "@/lib/auth/penjaga";

export const dynamic = "force-dynamic";

export default async function PenggunaPage() {
  const sesi = await sesiSemasa();
  if (!sesi) redirect("/masuk");
  if (sesi.peranan !== "admin") redirect("/");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Senarai pengguna</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lihat jadual waktu dan RPH setiap guru. Guru biasa hanya nampak data sendiri.
        </p>
      </div>
      <SenaraiPengguna />
    </div>
  );
}
