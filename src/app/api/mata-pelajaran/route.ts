import { NextResponse } from "next/server";
import { wajibSesi } from "@/lib/auth/penjaga";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";

function mesejKolumKod(mesej: string) {
  if (/kod/i.test(mesej) && /column|schema cache/i.test(mesej)) {
    return "Lajur kod belum ada. Jalankan bahagian mata pelajaran di hujung supabase/pengguna.sql dalam SQL Editor.";
  }
  return mesej;
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ mata_pelajaran: [] });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("mata_pelajaran")
      .select("id, kod, nama")
      .order("nama", { ascending: true });

    if (error && /kod/i.test(error.message) && /column|schema cache/i.test(error.message)) {
      const sandaran = await supabase.from("mata_pelajaran").select("id, nama").order("nama", { ascending: true });
      if (sandaran.error) throw new Error(sandaran.error.message);
      return NextResponse.json({
        mata_pelajaran: (sandaran.data ?? []).map((row) => ({ ...row, kod: null })),
        ralat: mesejKolumKod(error.message),
      });
    }
    if (error) throw new Error(error.message);
    return NextResponse.json({ mata_pelajaran: data ?? [] });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memuatkan mata pelajaran.";
    return NextResponse.json({ ralat: mesejKolumKod(mesej) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await wajibSesi();
  if (auth.ralat) return auth.ralat;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ralat: "Supabase belum dikonfigurasi." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { kod?: string; nama?: string };
  const kod = String(body.kod ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const nama = String(body.nama ?? "").replace(/\s+/g, " ").trim();
  if (!/^[A-Z0-9]{2,12}$/.test(kod)) {
    return NextResponse.json({ ralat: "Kod mesti 2–12 huruf atau nombor. Contoh: SK atau GEO." }, { status: 400 });
  }
  if (nama.length < 2) {
    return NextResponse.json({ ralat: "Nama mata pelajaran diperlukan." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data: sedia, error: ralatCari } = await supabase.from("mata_pelajaran").select("id, kod, nama");
    if (ralatCari) throw new Error(ralatCari.message);

    const sama = (sedia ?? []).find(
      (row) =>
        String(row.kod ?? "").toUpperCase() === kod ||
        String(row.nama ?? "").trim().toLowerCase() === nama.toLowerCase()
    );

    if (sama) {
      const { data, error } = await supabase
        .from("mata_pelajaran")
        .update({ kod, nama })
        .eq("id", sama.id)
        .select("id, kod, nama")
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ mata_pelajaran: data });
    }

    const { data, error } = await supabase
      .from("mata_pelajaran")
      .insert({ kod, nama })
      .select("id, kod, nama")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ mata_pelajaran: data });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal menyimpan mata pelajaran.";
    return NextResponse.json({ ralat: mesejKolumKod(mesej) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await wajibSesi();
  if (auth.ralat) return auth.ralat;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ralat: "Supabase belum dikonfigurasi." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ralat: "Mata pelajaran tidak dijumpai." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("mata_pelajaran").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memadam mata pelajaran.";
    const paparan = /foreign key|violates/i.test(mesej)
      ? "Mata pelajaran ini masih digunakan oleh DSKP."
      : mesej;
    return NextResponse.json({ ralat: paparan }, { status: 500 });
  }
}
