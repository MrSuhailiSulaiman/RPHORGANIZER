import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DskpKemasKini } from "@/components/dskp-kemas-kini";
import { Button } from "@/components/ui/button";
import { sesiSemasa } from "@/lib/auth/penjaga";
import { getDokumen } from "@/lib/dskp/queries";

export default async function DskpDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [dokumen, sesi] = await Promise.all([getDokumen(id), sesiSemasa()]);
  if (!dokumen) notFound();

  const tree = dokumen.bidang_pembelajaran.map((bidang) => ({
    kod: bidang.kod,
    nama: bidang.nama,
    penerangan: bidang.penerangan,
    jam: bidang.jam,
    standard_kandungan: bidang.standard_kandungan.map((sk) => ({
      kod: sk.kod,
      tajuk: sk.tajuk,
      standard_pembelajaran: sk.standard_pembelajaran.map((sp) => ({
        kod: sp.kod,
        pernyataan: sp.pernyataan,
        butiran: Array.isArray(sp.butiran) ? sp.butiran : [],
      })),
    })),
  }));

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/">
          <ArrowLeft />
          Senarai DSKP
        </Link>
      </Button>
      <DskpKemasKini
        id={dokumen.id}
        bolehEdit={sesi?.peranan === "admin"}
        mataPelajaran={dokumen.mata_pelajaran ?? ""}
        tingkatan={dokumen.tingkatan ?? ""}
        tahunTerbitan={dokumen.tahun_terbitan}
        namaFail={dokumen.nama_fail}
        kaedahAnalisis={dokumen.kaedah_analisis}
        bidang={tree}
      />
    </div>
  );
}
