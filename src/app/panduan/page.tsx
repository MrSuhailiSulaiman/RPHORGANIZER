import Link from "next/link";
import { BookOpen, CalendarClock, ClipboardList, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const LANGKAH = [
  { nombor: "1", tajuk: "DSKP", ringkas: "Semak senarai. Muat naik hanya jika tiada." },
  { nombor: "2", tajuk: "Jadual waktu", ringkas: "Muat naik jadual anda, kemudian simpan sesi PdP." },
  { nombor: "3", tajuk: "Generate RPH", ringkas: "Jana RPH setahun daripada jadual dan DSKP." },
];

export default function PanduanPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Panduan Pengguna Biasa</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Ikuti tiga langkah ini untuk menghasilkan RPH. DSKP dikongsi semua guru. Jadual waktu dan RPH
          milik akaun anda sahaja.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {LANGKAH.map((item) => (
          <div key={item.nombor} className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">Langkah {item.nombor}</p>
            <p className="mt-1 font-medium">{item.tajuk}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.ringkas}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="size-4" />
                Langkah 1 · Semak atau muat naik DSKP
              </CardTitle>
              <CardDescription>
                DSKP diperlukan supaya Generate RPH dapat isi Bidang, Standard Kandungan, dan Standard
                Pembelajaran. Muat naik hanya jika mata pelajaran dan tingkatan anda belum tersenarai.
              </CardDescription>
            </div>
            <Badge variant="secondary">Sekiranya tiada dalam senarai</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              Buka menu <strong className="text-foreground">DSKP</strong>. Lihat sama ada dokumen untuk
              mata pelajaran dan tingkatan anda sudah ada.
            </li>
            <li>
              Jika sudah ada, terus ke langkah 2. DSKP dikongsi — anda tidak perlu muat naik semula.
            </li>
            <li>
              Jika <strong className="text-foreground">tidak tersenarai</strong>, buka{" "}
              <strong className="text-foreground">Muat naik</strong>.
            </li>
            <li>
              Isi <strong className="text-foreground">Mata pelajaran</strong> (contoh Sains Komputer)
              dan pilih <strong className="text-foreground">Tingkatan</strong>. Nama mata pelajaran
              mestilah sama seperti pada jadual waktu nanti.
            </li>
            <li>
              Letak fail <strong className="text-foreground">PDF DSKP</strong> rasmi KSSM, kemudian
              klik <strong className="text-foreground">Analisis PDF</strong>.
            </li>
            <li>
              Semak Bidang, SK, dan SP. Jika betul, klik{" "}
              <strong className="text-foreground">Simpan ke Supabase</strong>.
            </li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/">Lihat senarai DSKP</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/muat-naik">
                <Upload />
                Muat naik DSKP
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4" />
            Langkah 2 · Muat naik jadual waktu
          </CardTitle>
          <CardDescription>
            Jadual ini milik akaun anda. Guru lain tidak dapat melihatnya. Setiap slot menjadi sesi PdP
            untuk Generate RPH.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              Buka menu <strong className="text-foreground">Jadual waktu</strong>.
            </li>
            <li>
              Muat naik <strong className="text-foreground">gambar jadual guru</strong> (JPG atau PNG).
              Elakkan HEIC dari iPhone — simpan sebagai JPG dahulu. PDF, CSV, atau Excel juga diterima.
            </li>
            <li>
              Sistem akan baca grid dan senaraikan sesi mengikut hari, masa, kelas, dan mata pelajaran.
              Semak dan betulkan jika ada slot yang silap.
            </li>
            <li>
              Klik <strong className="text-foreground">Simpan jadual</strong>. Selepas disimpan, sesi
              PdP sedia untuk dijana menjadi RPH.
            </li>
          </ol>
          <Button asChild size="sm">
            <Link href="/jadual-waktu">
              <CalendarClock />
              Buka jadual waktu
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-4" />
            Langkah 3 · Generate RPH
          </CardTitle>
          <CardDescription>
            Sistem menyusun setiap sesi PdP mengikut urutan DSKP, kemudian menulis objektif, BBM, nilai,
            dan aktiviti untuk 40 minggu persekolahan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              Buka menu <strong className="text-foreground">Borang RPH</strong>.
            </li>
            <li>
              Pada kad <strong className="text-foreground">Jana RPH setahun</strong>, pilih{" "}
              <strong className="text-foreground">Tarikh mula (Isnin)</strong> — biasanya Isnin pertama
              sesi persekolahan.
            </li>
            <li>
              Klik <strong className="text-foreground">Generate RPH</strong>. Tunggu sehingga selesai.
              Proses ini menjana RPH untuk semua sesi sepanjang tahun.
            </li>
            <li>
              Selepas siap, RPH dipaparkan mengikut minggu. Gunakan tapisan minggu,{" "}
              <strong className="text-foreground">Papar semua</strong>, atau buka satu sesi untuk semak
              dan kemaskini.
            </li>
            <li>
              Klik <strong className="text-foreground">Download RPH</strong> untuk PDF minggu tersebut,
              atau <strong className="text-foreground">Simpan</strong> selepas anda ubah isi borang.
            </li>
          </ol>
          <p className="rounded-lg border bg-muted/40 px-3 py-2">
            Generate RPH setahun akan ganti RPH sedia ada untuk tahun itu. Pastikan jadual dan DSKP
            sudah betul sebelum menjana.
          </p>
          <Button asChild size="sm">
            <Link href="/rph">
              <ClipboardList />
              Buka Borang RPH
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
