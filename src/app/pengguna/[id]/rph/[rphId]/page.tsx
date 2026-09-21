import { notFound, redirect } from "next/navigation";
import { LihatRphPengguna } from "@/components/lihat-rph-pengguna";
import { sesiSemasa } from "@/lib/auth/penjaga";
import { getPengguna } from "@/lib/auth/pengguna";

export const dynamic = "force-dynamic";

export default async function PenggunaRphDetailPage({
  params,
}: {
  params: Promise<{ id: string; rphId: string }>;
}) {
  const sesi = await sesiSemasa();
  if (!sesi) redirect("/masuk");
  if (sesi.peranan !== "admin") redirect("/");
  const { id, rphId } = await params;
  const pengguna = await getPengguna(id);
  if (!pengguna) notFound();
  return <LihatRphPengguna penggunaId={pengguna.id} rphId={rphId} />;
}
