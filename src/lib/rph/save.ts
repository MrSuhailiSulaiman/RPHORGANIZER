import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { supabaseRuntimeConfig } from "@/lib/runtime-env";
import type { KurikulumPilihan, RphRekod, RphStandard } from "./types";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function tableMissing(error: { message?: string }) {
  return /could not find the table|schema cache|does not exist/i.test(error.message ?? "");
}

function skemaRalat(error: { message?: string }) {
  if (tableMissing(error) || /simpan_jadual_waktu|simpan_rph|padam_semua_rph|padam_rph_tahun/i.test(error.message ?? "")) {
    return new Error(
      "Jadual RPH belum wujud dalam Supabase. Jalankan keseluruhan fail supabase/schema.sql dalam SQL Editor."
    );
  }
  return new Error(error.message ?? "Ralat pangkalan data.");
}

function asStandards(value: unknown): RphStandard[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      return {
        kod: String(row.kod ?? ""),
        pernyataan: String(row.pernyataan ?? ""),
      };
    }
    return { kod: "", pernyataan: String(item) };
  });
}

function mapRph(row: Record<string, unknown>): RphRekod {
  return {
    id: String(row.id),
    sesi_id: row.sesi_id ? String(row.sesi_id) : null,
    tarikh: row.tarikh ? String(row.tarikh) : null,
    hari: row.hari ? String(row.hari) : null,
    masa: row.masa ? String(row.masa) : null,
    tingkatan: row.tingkatan ? String(row.tingkatan) : null,
    kelas: row.kelas ? String(row.kelas) : null,
    mata_pelajaran: row.mata_pelajaran ? String(row.mata_pelajaran) : null,
    bidang_kod: row.bidang_kod ? String(row.bidang_kod) : null,
    bidang_nama: row.bidang_nama ? String(row.bidang_nama) : null,
    sk_kod: row.sk_kod ? String(row.sk_kod) : null,
    sk_tajuk: row.sk_tajuk ? String(row.sk_tajuk) : null,
    standard_pembelajaran: asStandards(row.standard_pembelajaran),
    objektif: asStringArray(row.objektif),
    bbm: row.bbm ? String(row.bbm) : null,
    nilai: row.nilai ? String(row.nilai) : null,
    aktiviti: asStringArray(row.aktiviti),
    refleksi_peratus: typeof row.refleksi_peratus === "number" ? row.refleksi_peratus : null,
    refleksi_berjaya: typeof row.refleksi_berjaya === "boolean" ? row.refleksi_berjaya : null,
    refleksi_catatan: row.refleksi_catatan ? String(row.refleksi_catatan) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

const RPH_PADAM = "__DIPADAM__";

export async function senaraiRph(): Promise<RphRekod[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("rph").select("*").order("tarikh", { ascending: false });
  if (error) {
    if (tableMissing(error)) return [];
    throw skemaRalat(error);
  }
  return (data ?? [])
    .map((row) => mapRph(row as Record<string, unknown>))
    .filter((row) => row.mata_pelajaran !== RPH_PADAM);
}

export async function getRph(id: string): Promise<RphRekod | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("rph").select("*").eq("id", id).maybeSingle();
  if (error) {
    if (tableMissing(error)) return null;
    throw skemaRalat(error);
  }
  if (!data) return null;
  const rekod = mapRph(data as Record<string, unknown>);
  if (rekod.mata_pelajaran === RPH_PADAM) return null;
  return rekod;
}

export async function simpanRph(payload: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("simpan_rph", { payload });
  if (error) throw skemaRalat(error);
  return { id: data as string };
}

export async function getKurikulum(
  mataPelajaran: string,
  tingkatan: string
): Promise<KurikulumPilihan | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createAdminClient();
  let query = supabase
    .from("dokumen_dskp")
    .select(
      `
      id,
      mata_pelajaran,
      tingkatan,
      bidang_pembelajaran (
        kod,
        nama,
        susunan,
        standard_kandungan (
          kod,
          tajuk,
          susunan,
          standard_pembelajaran (
            kod,
            pernyataan,
            susunan
          )
        )
      )
    `
    )
    .order("created_at", { ascending: false });

  if (mataPelajaran.trim()) {
    query = query.ilike("mata_pelajaran", `%${mataPelajaran.trim()}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const tahap = tingkatan.replace(/tingkatan/i, "").trim();
  const dokumen =
    (data ?? []).find((row) => {
      const nilai = String(row.tingkatan ?? "");
      return !tahap || nilai.includes(tahap);
    }) ?? data?.[0];
  if (!dokumen) return null;

  const bidang = [...(dokumen.bidang_pembelajaran ?? [])]
    .sort((a, b) => (a.susunan ?? 0) - (b.susunan ?? 0))
    .map((item) => ({
      kod: item.kod,
      nama: item.nama,
      standard_kandungan: [...(item.standard_kandungan ?? [])]
        .sort((a, b) => (a.susunan ?? 0) - (b.susunan ?? 0))
        .map((sk) => ({
          kod: sk.kod,
          tajuk: sk.tajuk,
          standard_pembelajaran: [...(sk.standard_pembelajaran ?? [])]
            .sort((a, b) => (a.susunan ?? 0) - (b.susunan ?? 0))
            .map((sp) => ({ kod: sp.kod, pernyataan: sp.pernyataan })),
        })),
    }));

  return {
    dokumen_id: dokumen.id,
    mata_pelajaran: dokumen.mata_pelajaran ?? mataPelajaran,
    tingkatan: dokumen.tingkatan,
    bidang,
  };
}

export async function getSemuaKurikulum(): Promise<KurikulumPilihan[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("dokumen_dskp")
    .select(
      `
      id,
      mata_pelajaran,
      tingkatan,
      bidang_pembelajaran (
        kod,
        nama,
        susunan,
        standard_kandungan (
          kod,
          tajuk,
          susunan,
          standard_pembelajaran (
            kod,
            pernyataan,
            susunan
          )
        )
      )
    `
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((dokumen) => {
    const bidang = [...(dokumen.bidang_pembelajaran ?? [])]
      .sort((a, b) => (a.susunan ?? 0) - (b.susunan ?? 0))
      .map((item) => ({
        kod: item.kod,
        nama: item.nama,
        standard_kandungan: [...(item.standard_kandungan ?? [])]
          .sort((a, b) => (a.susunan ?? 0) - (b.susunan ?? 0))
          .map((sk) => ({
            kod: sk.kod,
            tajuk: sk.tajuk,
            standard_pembelajaran: [...(sk.standard_pembelajaran ?? [])]
              .sort((a, b) => (a.susunan ?? 0) - (b.susunan ?? 0))
              .map((sp) => ({ kod: sp.kod, pernyataan: sp.pernyataan })),
          })),
      }));
    return {
      dokumen_id: dokumen.id,
      mata_pelajaran: dokumen.mata_pelajaran ?? "",
      tingkatan: dokumen.tingkatan,
      bidang,
    };
  });
}

export async function padamRphDalamTempoh(mula: string, tamat: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rph")
    .delete()
    .gte("tarikh", mula)
    .lte("tarikh", tamat)
    .select("id");
  if (!error && (data?.length ?? 0) > 0) return data.length;

  const { data: rpcBil, error: rpcRalat } = await supabase.rpc("padam_rph_tahun", {
    tarikh_mula: mula,
    tarikh_tamat: tamat,
  });
  if (!rpcRalat) return Number(rpcBil ?? 0);
  if (!error) return data?.length ?? 0;
  if (tableMissing(error) || tableMissing(rpcRalat)) return 0;
  throw skemaRalat(rpcRalat);
}

async function senaraiSemuaIdRph() {
  const { url, key } = supabaseRuntimeConfig();
  if (!url || !key) return [];
  const ids: string[] = [];
  for (let dari = 0; dari < 50000; dari += 1000) {
    const res = await fetch(`${url}/rest/v1/rph?select=id&limit=1000&offset=${dari}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) throw skemaRalat({ message: await res.text() });
    const data = (await res.json()) as { id?: string }[];
    ids.push(...data.map((row) => String(row.id)));
    if (data.length < 1000) break;
  }
  return ids;
}

async function padamId(ids: string[]) {
  const { url, key } = supabaseRuntimeConfig();
  if (!url || !key || !ids.length) return 0;
  const senarai = ids.join(",");
  const res = await fetch(`${url}/rest/v1/rph?id=in.(${senarai})`, {
    method: "DELETE",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=representation",
    },
    cache: "no-store",
  });
  if (!res.ok) throw skemaRalat({ message: await res.text() });
  const data = (await res.json().catch(() => [])) as unknown[];
  return Array.isArray(data) ? data.length : 0;
}

export async function padamSemuaRph() {
  const { url, key } = supabaseRuntimeConfig();
  if (!url || !key) throw new Error("Supabase belum dikonfigurasi.");

  const rpc = await fetch(`${url}/rest/v1/rpc/padam_semua_rph`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });
  if (rpc.ok) {
    const bil = Number(await rpc.text());
    const bakiRpc = await senaraiSemuaIdRph();
    if (!bakiRpc.length) return Number.isFinite(bil) ? bil : 0;
  }

  const semua = await fetch(`${url}/rest/v1/rph?id=not.is.null`, {
    method: "DELETE",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=representation,count=exact",
    },
    cache: "no-store",
  });
  if (semua.ok) {
    const data = (await semua.json().catch(() => [])) as unknown[];
    const baki = await senaraiSemuaIdRph();
    if (!baki.length) return Array.isArray(data) ? data.length : 0;
  }

  let bil = 0;
  for (let pusingan = 0; pusingan < 50; pusingan += 1) {
    const ids = await senaraiSemuaIdRph();
    if (!ids.length) return bil;
    let kaliIni = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const n = await padamId(ids.slice(i, i + 100));
      if (!n) break;
      kaliIni += n;
      bil += n;
    }
    if (!kaliIni) break;
  }

  const tinggal = await senaraiSemuaIdRph();
  if (tinggal.length) {
    throw new Error("RPH tidak dapat dipadam daripada pangkalan data. Rekod termasuk id masih wujud.");
  }
  return bil;
}

export async function simpanRphPukal(senarai: Record<string, unknown>[]) {
  if (!senarai.length) return 0;
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("simpan_rph_pukal", { senarai });
  if (!error) return senarai.length;

  const saiz = 8;
  let bil = 0;
  for (let i = 0; i < senarai.length; i += saiz) {
    const bahagian = senarai.slice(i, i + saiz);
    const hasil = await Promise.allSettled(bahagian.map((item) => simpanRph(item)));
    for (const item of hasil) {
      if (item.status === "fulfilled") bil += 1;
      else if (i === 0 && item.status === "rejected") {
        const sebab = item.reason instanceof Error ? item.reason : skemaRalat({ message: String(item.reason) });
        throw sebab;
      }
    }
  }
  return bil;
}
