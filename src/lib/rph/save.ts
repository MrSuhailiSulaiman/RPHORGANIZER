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

function bilPadam(res: Response) {
  const julat = res.headers.get("content-range") ?? "";
  const padanan = /\/(\d+)\s*$/.exec(julat);
  return padanan ? Number(padanan[1]) : 0;
}

type KunciSupabase = { url: string; key: string };

function kunciPadam(kunci?: KunciSupabase): KunciSupabase {
  const cfg = kunci ?? supabaseRuntimeConfig();
  return { url: cfg.url, key: cfg.key };
}

function kepalaPadam(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Prefer: "return=minimal,count=exact",
  };
}

async function senaraiSemuaIdRph(kunci: KunciSupabase) {
  if (!kunci.url || !kunci.key) return [];
  const ids: string[] = [];
  for (let dari = 0; dari < 50000; dari += 1000) {
    const res = await fetch(`${kunci.url}/rest/v1/rph?select=id&mata_pelajaran=not.eq.${encodeURIComponent(RPH_PADAM)}&limit=1000&offset=${dari}`, {
      headers: { apikey: kunci.key, Authorization: `Bearer ${kunci.key}` },
      cache: "no-store",
    });
    if (!res.ok) throw skemaRalat({ message: await res.text() });
    const data = (await res.json()) as { id?: string }[];
    ids.push(...data.map((row) => String(row.id)).filter((id) => id && id !== "undefined"));
    if (data.length < 1000) break;
  }
  return ids;
}

export async function bilanganSemuaRph(kunci?: KunciSupabase) {
  return (await senaraiSemuaIdRph(kunciPadam(kunci))).length;
}

async function padamSemuaBaris(kunci: KunciSupabase) {
  const rpc = await fetch(`${kunci.url}/rest/v1/rpc/padam_semua_rph`, {
    method: "POST",
    headers: {
      ...kepalaPadam(kunci.key),
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });
  if (rpc.ok) return Number((await rpc.text()) || "0");

  const res = await fetch(`${kunci.url}/rest/v1/rph?id=not.is.null`, {
    method: "DELETE",
    headers: kepalaPadam(kunci.key),
    cache: "no-store",
  });
  if (!res.ok) throw skemaRalat({ message: await res.text() });
  return bilPadam(res);
}

async function padamId(kunci: KunciSupabase, ids: string[]) {
  if (!ids.length) return 0;
  const senarai = ids.join(",");
  const res = await fetch(`${kunci.url}/rest/v1/rph?id=in.(${senarai})`, {
    method: "DELETE",
    headers: kepalaPadam(kunci.key),
    cache: "no-store",
  });
  if (!res.ok) throw skemaRalat({ message: await res.text() });
  return bilPadam(res);
}

export async function padamRph(id: string, kunci?: KunciSupabase) {
  const auth = kunciPadam(kunci);
  if (!auth.url || !auth.key) throw new Error("Supabase belum dikonfigurasi.");
  const bersih = id.trim();
  if (!bersih) throw new Error("Id RPH tidak sah.");

  const res = await fetch(`${auth.url}/rest/v1/rph?id=eq.${encodeURIComponent(bersih)}`, {
    method: "DELETE",
    headers: kepalaPadam(auth.key),
    cache: "no-store",
  });
  if (!res.ok) throw skemaRalat({ message: await res.text() });

  const semak = await fetch(`${auth.url}/rest/v1/rph?id=eq.${encodeURIComponent(bersih)}&select=id,mata_pelajaran`, {
    headers: { apikey: auth.key, Authorization: `Bearer ${auth.key}` },
    cache: "no-store",
  });
  if (!semak.ok) throw skemaRalat({ message: await semak.text() });
  const tinggal = (await semak.json()) as { id?: string; mata_pelajaran?: string }[];
  if (!tinggal.length || tinggal.every((row) => row.mata_pelajaran === RPH_PADAM)) return;

  const sorok = await fetch(`${auth.url}/rest/v1/rph?id=eq.${encodeURIComponent(bersih)}`, {
    method: "PATCH",
    headers: {
      ...kepalaPadam(auth.key),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mata_pelajaran: RPH_PADAM }),
    cache: "no-store",
  });
  if (!sorok.ok) throw skemaRalat({ message: await sorok.text() });

  const semakSemula = await fetch(
    `${auth.url}/rest/v1/rph?id=eq.${encodeURIComponent(bersih)}&select=id,mata_pelajaran`,
    {
      headers: { apikey: auth.key, Authorization: `Bearer ${auth.key}` },
      cache: "no-store",
    }
  );
  if (!semakSemula.ok) throw skemaRalat({ message: await semakSemula.text() });
  const baki = (await semakSemula.json()) as { mata_pelajaran?: string }[];
  if (baki.some((row) => row.mata_pelajaran !== RPH_PADAM)) {
    throw new Error("Rekod RPH tidak dapat dipadam daripada pangkalan data.");
  }
}

export async function padamRphPukal(ids: string[], kunci?: KunciSupabase) {
  const auth = kunciPadam(kunci);
  if (!auth.url || !auth.key) throw new Error("Supabase belum dikonfigurasi.");
  const bersih = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!bersih.length) return 0;

  for (let i = 0; i < bersih.length; i += 50) {
    await padamId(auth, bersih.slice(i, i + 50));
  }

  const tinggal: { id?: string; mata_pelajaran?: string }[] = [];
  for (let i = 0; i < bersih.length; i += 50) {
    const bahagian = bersih.slice(i, i + 50);
    const semak = await fetch(
      `${auth.url}/rest/v1/rph?id=in.(${bahagian.join(",")})&select=id,mata_pelajaran`,
      {
        headers: { apikey: auth.key, Authorization: `Bearer ${auth.key}` },
        cache: "no-store",
      }
    );
    if (!semak.ok) throw skemaRalat({ message: await semak.text() });
    const data = (await semak.json()) as { id?: string; mata_pelajaran?: string }[];
    tinggal.push(...data.filter((row) => row.mata_pelajaran !== RPH_PADAM));
  }
  if (tinggal.length) {
    const idsTinggal = tinggal.map((row) => String(row.id)).filter(Boolean);
    for (let i = 0; i < idsTinggal.length; i += 50) {
      const bahagian = idsTinggal.slice(i, i + 50);
      const sorok = await fetch(`${auth.url}/rest/v1/rph?id=in.(${bahagian.join(",")})`, {
        method: "PATCH",
        headers: {
          ...kepalaPadam(auth.key),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mata_pelajaran: RPH_PADAM }),
        cache: "no-store",
      });
      if (!sorok.ok) throw skemaRalat({ message: await sorok.text() });
    }
  }
  return bersih.length;
}

export async function padamSemuaRph(kunci?: KunciSupabase) {
  const auth = kunciPadam(kunci);
  if (!auth.url || !auth.key) throw new Error("Supabase belum dikonfigurasi.");

  const sebelum = await senaraiSemuaIdRph(auth);
  if (!sebelum.length) return 0;

  for (let cubaan = 0; cubaan < 6; cubaan += 1) {
    await padamSemuaBaris(auth);
    let ids = await senaraiSemuaIdRph(auth);
    if (!ids.length) return sebelum.length;
    for (let i = 0; i < ids.length; i += 50) {
      await padamId(auth, ids.slice(i, i + 50));
    }
    ids = await senaraiSemuaIdRph(auth);
    if (!ids.length) return sebelum.length;
  }

  const tinggal = await senaraiSemuaIdRph(auth);
  if (tinggal.length) {
    throw new Error(
      `RPH tidak dapat dipadam daripada pangkalan data. ${tinggal.length} rekod termasuk id masih wujud dalam Supabase.`
    );
  }
  return sebelum.length;
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
