import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { gabungBidangSama } from "@/lib/dskp/gabung";
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
      const butiran = asStringArray(row.butiran).filter((baris) => baris.trim());
      return {
        kod: String(row.kod ?? ""),
        pernyataan: String(row.pernyataan ?? ""),
        ...(butiran.length ? { butiran } : {}),
      };
    }
    return { kod: "", pernyataan: String(item) };
  });
}

function teksAtauNull(value: unknown) {
  const teks = value == null ? "" : String(value).trim();
  return teks || null;
}

function bacaNombor(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const nombor = Number(value);
    return Number.isFinite(nombor) ? nombor : null;
  }
  return null;
}

function bacaBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "ya") return true;
  if (value === "false" || value === "tidak") return false;
  return null;
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
    refleksi_peratus: bacaNombor(row.refleksi_peratus),
    refleksi_berjaya: bacaBoolean(row.refleksi_berjaya),
    refleksi_catatan: row.refleksi_catatan ? String(row.refleksi_catatan) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function barisRphDariMuatan(payload: Record<string, unknown>, penggunaId: string) {
  const id = teksAtauNull(payload.id) ?? crypto.randomUUID();
  const peratus = bacaNombor(payload.refleksi_peratus);
  return {
    id,
    sesi_id: teksAtauNull(payload.sesi_id),
    tarikh: teksAtauNull(payload.tarikh)?.slice(0, 10) ?? null,
    hari: teksAtauNull(payload.hari),
    masa: teksAtauNull(payload.masa),
    tingkatan: teksAtauNull(payload.tingkatan),
    kelas: teksAtauNull(payload.kelas),
    mata_pelajaran: teksAtauNull(payload.mata_pelajaran),
    bidang_kod: teksAtauNull(payload.bidang_kod),
    bidang_nama: teksAtauNull(payload.bidang_nama),
    sk_kod: teksAtauNull(payload.sk_kod),
    sk_tajuk: teksAtauNull(payload.sk_tajuk),
    standard_pembelajaran: asStandards(payload.standard_pembelajaran),
    objektif: asStringArray(payload.objektif),
    bbm: teksAtauNull(payload.bbm),
    nilai: teksAtauNull(payload.nilai),
    aktiviti: asStringArray(payload.aktiviti),
    refleksi_peratus: peratus == null ? null : Math.round(Math.min(100, Math.max(0, peratus))),
    refleksi_berjaya: bacaBoolean(payload.refleksi_berjaya),
    refleksi_catatan: teksAtauNull(payload.refleksi_catatan),
    pengguna_id: penggunaId,
    updated_at: new Date().toISOString(),
  };
}

async function tulisBarisRph(
  supabase: SupabaseClient,
  baris: ReturnType<typeof barisRphDariMuatan>
) {
  const { data, error } = await supabase
    .from("rph")
    .upsert(baris, { onConflict: "id", ignoreDuplicates: false, defaultToNull: false })
    .select("id")
    .maybeSingle();
  if (!error && data?.id) {
    await supabase
      .from("rph")
      .update({
        refleksi_peratus: baris.refleksi_peratus,
        refleksi_berjaya: baris.refleksi_berjaya,
        refleksi_catatan: baris.refleksi_catatan,
      })
      .eq("id", data.id);
    return String(data.id);
  }

  const rpc = await supabase.rpc("simpan_rph", { payload: baris });
  if (rpc.error) throw error ? skemaRalat(error) : skemaRalat(rpc.error);
  const id = rpc.data ? String(rpc.data) : baris.id;
  await supabase
    .from("rph")
    .update({
      refleksi_peratus: baris.refleksi_peratus,
      refleksi_berjaya: baris.refleksi_berjaya,
      refleksi_catatan: baris.refleksi_catatan,
      nilai: baris.nilai,
      pengguna_id: baris.pengguna_id,
    })
    .eq("id", id);
  return id;
}

const RPH_PADAM = "__DIPADAM__";

const RUANGAN_SENARAI =
  "id,sesi_id,tarikh,hari,masa,tingkatan,kelas,mata_pelajaran,bidang_kod,bidang_nama,sk_kod,sk_tajuk,created_at,updated_at";

export async function senaraiRph(penggunaId: string): Promise<RphRekod[]> {
  if (!isSupabaseConfigured() || !penggunaId) return [];
  const supabase = createAdminClient();
  const semua: RphRekod[] = [];
  for (let dari = 0; dari < 50000; dari += 1000) {
    const { data, error } = await supabase
      .from("rph")
      .select(RUANGAN_SENARAI)
      .eq("pengguna_id", penggunaId)
      .order("tarikh", { ascending: false })
      .range(dari, dari + 999);
    if (error) {
      if (tableMissing(error)) return [];
      throw skemaRalat(error);
    }
    const baris = (data ?? [])
      .map((row) => mapRph(row as Record<string, unknown>))
      .filter((row) => row.mata_pelajaran !== RPH_PADAM);
    semua.push(...baris);
    if ((data?.length ?? 0) < 1000) break;
  }
  return semua;
}

export async function getRph(id: string, penggunaId: string): Promise<RphRekod | null> {
  if (!isSupabaseConfigured() || !penggunaId) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rph")
    .select("*")
    .eq("id", id)
    .eq("pengguna_id", penggunaId)
    .maybeSingle();
  if (error) {
    if (tableMissing(error)) return null;
    throw skemaRalat(error);
  }
  if (!data) return null;
  const rekod = mapRph(data as Record<string, unknown>);
  if (rekod.mata_pelajaran === RPH_PADAM) return null;
  return rekod;
}

export async function getRphMengikutId(ids: string[], penggunaId: string): Promise<RphRekod[]> {
  if (!isSupabaseConfigured() || !penggunaId) return [];
  const bersih = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!bersih.length) return [];
  const supabase = createAdminClient();
  const semua: RphRekod[] = [];
  for (let i = 0; i < bersih.length; i += 50) {
    const bahagian = bersih.slice(i, i + 50);
    const { data, error } = await supabase
      .from("rph")
      .select("*")
      .eq("pengguna_id", penggunaId)
      .in("id", bahagian);
    if (error) {
      if (tableMissing(error)) return [];
      throw skemaRalat(error);
    }
    semua.push(
      ...(data ?? [])
        .map((row) => mapRph(row as Record<string, unknown>))
        .filter((row) => row.mata_pelajaran !== RPH_PADAM)
    );
  }
  const susunan = new Map(bersih.map((id, indeks) => [id, indeks]));
  return semua.sort((a, b) => (susunan.get(a.id) ?? 0) - (susunan.get(b.id) ?? 0));
}

export async function simpanRph(payload: Record<string, unknown>, penggunaId: string) {
  if (!penggunaId) throw new Error("Sila log masuk.");
  const idSedia = typeof payload.id === "string" ? payload.id.trim() : "";
  if (idSedia) {
    const sedia = await getRph(idSedia, penggunaId);
    if (!sedia) throw new Error("RPH tidak dijumpai.");
  }
  const supabase = createAdminClient();
  const id = await tulisBarisRph(supabase, barisRphDariMuatan(payload, penggunaId));
  return { id };
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
            butiran,
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

  const bidang = gabungBidangSama(
    [...(dokumen.bidang_pembelajaran ?? [])]
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
              .map((sp) => ({
                kod: sp.kod,
                pernyataan: sp.pernyataan,
                butiran: asStringArray(sp.butiran).filter((baris) => baris.trim()),
              })),
          })),
      }))
  );

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
            butiran,
            susunan
          )
        )
      )
    `
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((dokumen) => {
    const bidang = gabungBidangSama(
      [...(dokumen.bidang_pembelajaran ?? [])]
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
                .map((sp) => ({
                  kod: sp.kod,
                  pernyataan: sp.pernyataan,
                  butiran: asStringArray(sp.butiran).filter((baris) => baris.trim()),
                })),
            })),
        }))
    );
    return {
      dokumen_id: dokumen.id,
      mata_pelajaran: dokumen.mata_pelajaran ?? "",
      tingkatan: dokumen.tingkatan,
      bidang,
    };
  });
}

export async function padamRphDalamTempoh(mula: string, tamat: string, penggunaId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rph")
    .delete()
    .eq("pengguna_id", penggunaId)
    .gte("tarikh", mula)
    .lte("tarikh", tamat)
    .select("id");
  if (!error && (data?.length ?? 0) > 0) return data.length;
  if (!error) return data?.length ?? 0;
  if (tableMissing(error)) return 0;
  throw skemaRalat(error);
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

function klienPadam(auth: KunciSupabase): SupabaseClient {
  return createClient(auth.url, auth.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${auth.key}` } },
  });
}

function kepalaPadam(key: string, representation = false) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Prefer: representation ? "return=representation" : "return=minimal,count=exact",
  };
}

async function fetchPadam(url: string, init: RequestInit, ms = 12000) {
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(ms) });
  } catch {
    return null;
  }
}

async function masihAdaRph(supabase: SupabaseClient, ids: string[]) {
  if (!ids.length) return [];
  const tinggal: string[] = [];
  for (let i = 0; i < ids.length; i += 40) {
    const bahagian = ids.slice(i, i + 40);
    const { data, error } = await supabase.from("rph").select("id,mata_pelajaran").in("id", bahagian);
    if (error) throw skemaRalat(error);
    tinggal.push(
      ...(data ?? [])
        .filter((row) => row.mata_pelajaran !== RPH_PADAM)
        .map((row) => String(row.id))
    );
  }
  return tinggal;
}

async function sorokRph(supabase: SupabaseClient, ids: string[]) {
  for (let i = 0; i < ids.length; i += 8) {
    await Promise.all(
      ids.slice(i, i + 8).map((id) =>
        supabase.rpc("simpan_rph", {
          payload: { id, mata_pelajaran: RPH_PADAM, kelas: "-", hari: "ISNIN" },
        })
      )
    );
  }
}

async function senaraiSemuaIdRph(kunci: KunciSupabase, penggunaId?: string) {
  if (!kunci.url || !kunci.key) return [];
  const tapis = penggunaId
    ? `&pengguna_id=eq.${encodeURIComponent(penggunaId)}`
    : "";
  const ids: string[] = [];
  for (let dari = 0; dari < 50000; dari += 1000) {
    const res = await fetchPadam(
      `${kunci.url}/rest/v1/rph?select=id&mata_pelajaran=not.eq.${encodeURIComponent(RPH_PADAM)}${tapis}&limit=1000&offset=${dari}`,
      { headers: { apikey: kunci.key, Authorization: `Bearer ${kunci.key}` } },
      15000
    );
    if (!res?.ok) {
      throw skemaRalat({ message: res ? await res.text() : "Tidak dapat membaca senarai RPH." });
    }
    const data = (await res.json()) as { id?: string }[];
    ids.push(...data.map((row) => String(row.id)).filter((id) => id && id !== "undefined"));
    if (data.length < 1000) break;
  }
  return ids;
}

async function bilanganRph(kunci: KunciSupabase, penggunaId?: string) {
  const tapis = penggunaId ? `&pengguna_id=eq.${encodeURIComponent(penggunaId)}` : "";
  const res = await fetchPadam(
    `${kunci.url}/rest/v1/rph?select=id&mata_pelajaran=not.eq.${encodeURIComponent(RPH_PADAM)}${tapis}`,
    {
      method: "HEAD",
      headers: {
        apikey: kunci.key,
        Authorization: `Bearer ${kunci.key}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    },
    10000
  );
  const julat = res?.headers.get("content-range") ?? "";
  const padanan = /\/(\d+)\s*$/.exec(julat);
  if (padanan) return Number(padanan[1]);
  return (await senaraiSemuaIdRph(kunci, penggunaId)).length;
}

export async function bilanganSemuaRph(kunci?: KunciSupabase, penggunaId?: string) {
  return bilanganRph(kunciPadam(kunci), penggunaId);
}

async function padamSemuaBaris(kunci: KunciSupabase, penggunaId: string) {
  const kepala = kepalaPadam(kunci.key);
  const rpc = await fetchPadam(
    `${kunci.url}/rest/v1/rpc/padam_rph_pengguna`,
    {
      method: "POST",
      headers: { ...kepala, "Content-Type": "application/json" },
      body: JSON.stringify({ p_pengguna_id: penggunaId }),
    },
    15000
  );
  if (rpc?.ok) return Number((await rpc.text()).replace(/[^\d-]/g, "") || "0");

  const res = await fetchPadam(
    `${kunci.url}/rest/v1/rph?pengguna_id=eq.${encodeURIComponent(penggunaId)}`,
    { method: "DELETE", headers: kepala },
    15000
  );
  if (res?.ok) return bilPadam(res);
  return 0;
}

async function padamId(kunci: KunciSupabase, ids: string[]) {
  if (!ids.length) return 0;
  const senarai = encodeURIComponent(`(${ids.map((id) => `"${id}"`).join(",")})`);
  const res = await fetchPadam(
    `${kunci.url}/rest/v1/rph?id=in.${senarai}`,
    { method: "DELETE", headers: kepalaPadam(kunci.key) },
    15000
  );
  if (!res?.ok) return 0;
  return bilPadam(res);
}

export async function padamRph(id: string, kunci?: KunciSupabase, penggunaId?: string) {
  await padamRphPukal([id], kunci, penggunaId);
}

export async function padamRphPukal(ids: string[], kunci?: KunciSupabase, penggunaId?: string) {
  const auth = kunciPadam(kunci);
  if (!auth.url || !auth.key) throw new Error("Supabase belum dikonfigurasi.");
  const bersih = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!bersih.length) return 0;
  const supabase = klienPadam(auth);
  const milik = penggunaId
    ? (await getRphMengikutId(bersih, penggunaId)).map((item) => item.id)
    : bersih;
  if (!milik.length) return 0;

  for (let i = 0; i < milik.length; i += 80) {
    await supabase.rpc("padam_rph_ids", { ids: milik.slice(i, i + 80) });
  }
  let tinggal = await masihAdaRph(supabase, milik);
  if (penggunaId) tinggal = tinggal.filter((id) => milik.includes(id));
  if (!tinggal.length) return milik.length;

  for (let i = 0; i < tinggal.length; i += 40) {
    let q = supabase.from("rph").delete().in("id", tinggal.slice(i, i + 40));
    if (penggunaId) q = q.eq("pengguna_id", penggunaId);
    await q;
  }
  tinggal = await masihAdaRph(supabase, milik);
  if (!tinggal.length) return milik.length;

  for (let i = 0; i < tinggal.length; i += 40) {
    await padamId(auth, tinggal.slice(i, i + 40));
  }
  tinggal = await masihAdaRph(supabase, milik);
  if (!tinggal.length) return milik.length;

  await sorokRph(supabase, tinggal);
  tinggal = await masihAdaRph(supabase, milik);
  if (tinggal.length) {
    throw new Error("Rekod RPH tidak dapat dipadam daripada pangkalan data.");
  }
  return milik.length;
}

export async function padamSemuaRph(kunci?: KunciSupabase, penggunaId?: string) {
  const auth = kunciPadam(kunci);
  if (!auth.url || !auth.key) throw new Error("Supabase belum dikonfigurasi.");
  if (!penggunaId) throw new Error("Sila log masuk.");

  const sebelum = await bilanganRph(auth, penggunaId);
  if (!sebelum) return 0;

  await padamSemuaBaris(auth, penggunaId);
  if (!(await bilanganRph(auth, penggunaId))) return sebelum;

  const ids = await senaraiSemuaIdRph(auth, penggunaId);
  if (ids.length) await padamRphPukal(ids, auth, penggunaId);

  const baki = await bilanganRph(auth, penggunaId);
  if (baki) {
    throw new Error(
      `RPH tidak dapat dipadam daripada pangkalan data. ${baki} rekod termasuk id masih wujud dalam Supabase.`
    );
  }
  return sebelum;
}

export async function simpanRphPukal(senarai: Record<string, unknown>[], penggunaId: string) {
  if (!senarai.length) return 0;
  if (!penggunaId) throw new Error("Sila log masuk.");
  const idsSedia = senarai
    .map((item) => (typeof item.id === "string" ? item.id.trim() : ""))
    .filter(Boolean);
  if (idsSedia.length) {
    const milik = new Set((await getRphMengikutId(idsSedia, penggunaId)).map((item) => item.id));
    const asing = idsSedia.find((id) => !milik.has(id));
    if (asing) throw new Error("RPH tidak dijumpai.");
  }

  const supabase = createAdminClient();
  const baris = senarai.map((item) => barisRphDariMuatan(item, penggunaId));
  const saiz = 25;
  for (let i = 0; i < baris.length; i += saiz) {
    const bahagian = baris.slice(i, i + saiz);
    const { error } = await supabase
      .from("rph")
      .upsert(bahagian, { onConflict: "id", ignoreDuplicates: false, defaultToNull: false });
    if (error) {
      const hasil = await Promise.allSettled(bahagian.map((item) => tulisBarisRph(supabase, item)));
      for (const item of hasil) {
        if (item.status === "rejected") {
          throw item.reason instanceof Error ? item.reason : skemaRalat({ message: String(item.reason) });
        }
      }
    }
  }
  return baris.length;
}
