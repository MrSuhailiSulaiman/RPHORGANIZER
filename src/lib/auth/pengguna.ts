import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { hashKataLaluan, normalNamaPengguna, sahNamaPengguna, sahkanKataLaluan } from "./kata-laluan";
import type { PerananPengguna } from "./sesi";

export type RekodPengguna = {
  id: string;
  nama_pengguna: string;
  peranan: PerananPengguna;
  created_at?: string;
};

export type RekodPenggunaSenarai = RekodPengguna & {
  created_at: string;
  bil_rph: number;
  bil_sesi: number;
};

const ADMIN_NAMA = "admin";
const ADMIN_KATA = "admin123";

function ralatSkema(error: { message?: string } | null) {
  const mesej = error?.message ?? "";
  if (/could not find the table|schema cache|pengguna/i.test(mesej)) {
    return new Error(
      "Jadual pengguna belum wujud. Jalankan fail supabase/pengguna.sql dalam SQL Editor Supabase."
    );
  }
  return new Error(mesej || "Ralat pangkalan data.");
}

function petaPengguna(row: {
  id: string;
  nama_pengguna: string;
  peranan?: string;
  created_at?: string | null;
}): RekodPengguna {
  return {
    id: row.id,
    nama_pengguna: row.nama_pengguna,
    peranan: row.peranan === "admin" ? "admin" : "pengguna",
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

let adminSedia = false;

export async function pastikanAdmin() {
  if (adminSedia || !isSupabaseConfigured()) return;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pengguna")
    .select("id")
    .eq("nama_pengguna", ADMIN_NAMA)
    .maybeSingle();
  if (error) throw ralatSkema(error);
  let adminId = data?.id as string | undefined;
  if (!adminId) {
    const { data: cipta, error: ciptaRalat } = await supabase
      .from("pengguna")
      .insert({
        nama_pengguna: ADMIN_NAMA,
        kata_laluan_hash: hashKataLaluan(ADMIN_KATA),
        peranan: "admin",
      })
      .select("id")
      .single();
    if (ciptaRalat) throw ralatSkema(ciptaRalat);
    adminId = cipta.id as string;
  }
  if (adminId) {
    await supabase.from("rph").update({ pengguna_id: adminId }).is("pengguna_id", null);
    await supabase.from("jadual_waktu").update({ pengguna_id: adminId }).is("pengguna_id", null);
    await supabase.from("sesi_pdp").update({ pengguna_id: adminId }).is("pengguna_id", null);
  }
  adminSedia = true;
}

export async function daftarPengguna(nama: string, kataLaluan: string): Promise<RekodPengguna> {
  await pastikanAdmin();
  const namaPengguna = normalNamaPengguna(nama);
  if (!sahNamaPengguna(namaPengguna)) {
    throw new Error("Nama pengguna mesti 3-32 aksara: huruf, nombor, titik, _ atau -.");
  }
  if (namaPengguna === ADMIN_NAMA) {
    throw new Error("Nama pengguna ini telah digunakan.");
  }
  if (kataLaluan.length < 6) {
    throw new Error("Kata laluan mestilah sekurang-kurangnya 6 aksara.");
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pengguna")
    .insert({
      nama_pengguna: namaPengguna,
      kata_laluan_hash: hashKataLaluan(kataLaluan),
      peranan: "pengguna",
    })
    .select("id,nama_pengguna,peranan")
    .single();
  if (error) {
    if (/duplicate|unique/i.test(error.message ?? "")) {
      throw new Error("Nama pengguna ini telah digunakan.");
    }
    throw ralatSkema(error);
  }
  return petaPengguna(data);
}

export async function logMasukPengguna(nama: string, kataLaluan: string): Promise<RekodPengguna> {
  await pastikanAdmin();
  const namaPengguna = normalNamaPengguna(nama);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pengguna")
    .select("id,nama_pengguna,peranan,kata_laluan_hash")
    .eq("nama_pengguna", namaPengguna)
    .maybeSingle();
  if (error) throw ralatSkema(error);
  if (!data || !sahkanKataLaluan(kataLaluan, String(data.kata_laluan_hash ?? ""))) {
    throw new Error("Nama pengguna atau kata laluan tidak sah.");
  }
  return petaPengguna(data);
}

export async function getPengguna(id: string): Promise<RekodPengguna | null> {
  await pastikanAdmin();
  if (!isSupabaseConfigured() || !id) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pengguna")
    .select("id,nama_pengguna,peranan,created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw ralatSkema(error);
  if (!data) return null;
  return petaPengguna(data);
}

export async function senaraiPengguna(): Promise<RekodPenggunaSenarai[]> {
  await pastikanAdmin();
  if (!isSupabaseConfigured()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pengguna")
    .select("id,nama_pengguna,peranan,created_at")
    .order("nama_pengguna");
  if (error) throw ralatSkema(error);

  const senarai = data ?? [];
  const kiraan = await Promise.all(
    senarai.map(async (row) => {
      const [{ count: bilRph }, { count: bilSesi }] = await Promise.all([
        supabase
          .from("rph")
          .select("id", { count: "exact", head: true })
          .eq("pengguna_id", row.id)
          .neq("mata_pelajaran", "__DIPADAM__"),
        supabase
          .from("sesi_pdp")
          .select("id", { count: "exact", head: true })
          .eq("pengguna_id", row.id),
      ]);
      return [row.id as string, { bil_rph: bilRph ?? 0, bil_sesi: bilSesi ?? 0 }] as const;
    })
  );
  const peta = new Map(kiraan);

  return senarai.map((row) => {
    const bil = peta.get(row.id) ?? { bil_rph: 0, bil_sesi: 0 };
    return {
      ...petaPengguna(row),
      created_at: row.created_at ? String(row.created_at) : "",
      bil_rph: bil.bil_rph,
      bil_sesi: bil.bil_sesi,
    };
  });
}
