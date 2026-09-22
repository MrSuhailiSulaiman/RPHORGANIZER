import { notFound } from "next/navigation";
import { PaparMingguKongsi } from "@/components/papar-minggu-kongsi";
import { paparanKongsiRph } from "@/lib/rph/kongsi";

export const dynamic = "force-dynamic";

export default async function HalamanKongsiRph({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const paparan = await paparanKongsiRph(t);
  if (!paparan) notFound();

  return (
    <PaparMingguKongsi
      minggu={paparan.minggu}
      nama={paparan.nama}
      tarikh_mula={paparan.tarikh_mula}
      tarikh_tamat={paparan.tarikh_tamat}
      rph={paparan.rph}
    />
  );
}
