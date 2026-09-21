import { notFound, redirect } from "next/navigation";
import { SenaraiRphPengguna } from "@/components/senarai-rph-pengguna";
import { sesiSemasa } from "@/lib/auth/penjaga";
import { getPengguna } from "@/lib/auth/pengguna";

export const dynamic = "force-dynamic";

export default async function PenggunaRphPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sesi = await sesiSemasa();
  if (!sesi) redirect("/masuk");
  if (sesi.peranan !== "admin") redirect("/");
  const { id } = await params;
  const pengguna = await getPengguna(id);
  if (!pengguna) notFound();
  return <SenaraiRphPengguna penggunaId={pengguna.id} />;
}
