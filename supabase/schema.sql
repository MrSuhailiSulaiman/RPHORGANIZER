-- e-RPH: skema DSKP KSSM
-- Jalankan dalam SQL Editor projek Supabase.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Jadual
-- ---------------------------------------------------------------------------

create table if not exists public.mata_pelajaran (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  nama_normal text generated always as (lower(btrim(nama))) stored,
  created_at timestamptz not null default now(),
  constraint mata_pelajaran_nama_normal_key unique (nama_normal)
);

create table if not exists public.dokumen_dskp (
  id uuid primary key default gen_random_uuid(),
  nama_fail text not null,
  mata_pelajaran_id uuid references public.mata_pelajaran(id),
  mata_pelajaran text,
  tingkatan text,
  tahun_terbitan text,
  storage_path text,
  fail_hash text,
  kaedah_analisis text,
  status text not null default 'completed' check (status in ('processing', 'completed', 'failed')),
  ralat text,
  created_at timestamptz not null default now()
);

alter table public.dokumen_dskp
  add column if not exists mata_pelajaran_id uuid references public.mata_pelajaran(id);

create table if not exists public.bidang_pembelajaran (
  id uuid primary key default gen_random_uuid(),
  dskp_id uuid not null references public.dokumen_dskp(id) on delete cascade,
  kod text not null,
  nama text not null,
  penerangan text,
  jam numeric,
  susunan integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.standard_kandungan (
  id uuid primary key default gen_random_uuid(),
  bidang_id uuid not null references public.bidang_pembelajaran(id) on delete cascade,
  kod text not null,
  tajuk text not null,
  susunan integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.standard_pembelajaran (
  id uuid primary key default gen_random_uuid(),
  sk_id uuid not null references public.standard_kandungan(id) on delete cascade,
  kod text not null,
  pernyataan text not null,
  butiran jsonb not null default '[]'::jsonb,
  susunan integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists bidang_dskp_idx on public.bidang_pembelajaran (dskp_id, susunan);
create index if not exists sk_bidang_idx on public.standard_kandungan (bidang_id, susunan);
create index if not exists sp_sk_idx on public.standard_pembelajaran (sk_id, susunan);
create index if not exists dokumen_created_idx on public.dokumen_dskp (created_at desc);
create index if not exists dokumen_mp_idx on public.dokumen_dskp (mata_pelajaran_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.mata_pelajaran enable row level security;
alter table public.dokumen_dskp enable row level security;
alter table public.bidang_pembelajaran enable row level security;
alter table public.standard_kandungan enable row level security;
alter table public.standard_pembelajaran enable row level security;

drop policy if exists "baca mata pelajaran" on public.mata_pelajaran;
create policy "baca mata pelajaran" on public.mata_pelajaran for select using (true);

drop policy if exists "baca dokumen dskp" on public.dokumen_dskp;
create policy "baca dokumen dskp" on public.dokumen_dskp for select using (true);

drop policy if exists "baca bidang" on public.bidang_pembelajaran;
create policy "baca bidang" on public.bidang_pembelajaran for select using (true);

drop policy if exists "baca standard kandungan" on public.standard_kandungan;
create policy "baca standard kandungan" on public.standard_kandungan for select using (true);

drop policy if exists "baca standard pembelajaran" on public.standard_pembelajaran;
create policy "baca standard pembelajaran" on public.standard_pembelajaran for select using (true);

-- ---------------------------------------------------------------------------
-- Simpan keseluruhan DSKP dalam satu transaksi
-- ---------------------------------------------------------------------------

create or replace function public.simpan_dskp(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc_id uuid;
  v_bidang jsonb;
  v_sk jsonb;
  v_sp jsonb;
  v_bidang_id uuid;
  v_sk_id uuid;
  v_b_idx int := 0;
  v_s_idx int := 0;
  v_p_idx int := 0;
  v_jam numeric;
  v_mp_id uuid;
  v_mp_nama text;
  v_tingkatan text;
begin
  v_mp_nama := btrim(coalesce(payload->>'mata_pelajaran', ''));
  v_tingkatan := btrim(coalesce(payload->>'tingkatan', ''));

  if v_mp_nama = '' then
    raise exception 'Mata pelajaran diperlukan';
  end if;
  if v_tingkatan = '' then
    raise exception 'Tingkatan diperlukan';
  end if;

  insert into public.mata_pelajaran (nama)
  values (v_mp_nama)
  on conflict on constraint mata_pelajaran_nama_normal_key
  do update set nama = excluded.nama
  returning id into v_mp_id;

  insert into public.dokumen_dskp (
    nama_fail,
    mata_pelajaran_id,
    mata_pelajaran,
    tingkatan,
    tahun_terbitan,
    storage_path,
    fail_hash,
    kaedah_analisis,
    status
  ) values (
    payload->>'nama_fail',
    v_mp_id,
    v_mp_nama,
    v_tingkatan,
    nullif(payload->>'tahun_terbitan', ''),
    nullif(payload->>'storage_path', ''),
    nullif(payload->>'fail_hash', ''),
    nullif(payload->>'kaedah_analisis', ''),
    'completed'
  ) returning id into v_doc_id;

  for v_bidang in select value from jsonb_array_elements(coalesce(payload->'bidang', '[]'::jsonb))
  loop
    if jsonb_typeof(v_bidang->'jam') = 'number' then
      v_jam := (v_bidang->>'jam')::numeric;
    elsif coalesce(v_bidang->>'jam', '') ~ '^[0-9]+(\.[0-9]+)?$' then
      v_jam := (v_bidang->>'jam')::numeric;
    else
      v_jam := null;
    end if;

    insert into public.bidang_pembelajaran (dskp_id, kod, nama, penerangan, jam, susunan)
    values (
      v_doc_id,
      coalesce(v_bidang->>'kod', ''),
      coalesce(v_bidang->>'nama', 'Tidak bernama'),
      nullif(v_bidang->>'penerangan', ''),
      v_jam,
      v_b_idx
    ) returning id into v_bidang_id;

    v_b_idx := v_b_idx + 1;
    v_s_idx := 0;

    for v_sk in select value from jsonb_array_elements(coalesce(v_bidang->'standard_kandungan', '[]'::jsonb))
    loop
      insert into public.standard_kandungan (bidang_id, kod, tajuk, susunan)
      values (
        v_bidang_id,
        coalesce(v_sk->>'kod', ''),
        coalesce(v_sk->>'tajuk', 'Tidak bertajuk'),
        v_s_idx
      ) returning id into v_sk_id;

      v_s_idx := v_s_idx + 1;
      v_p_idx := 0;

      for v_sp in select value from jsonb_array_elements(coalesce(v_sk->'standard_pembelajaran', '[]'::jsonb))
      loop
        insert into public.standard_pembelajaran (sk_id, kod, pernyataan, butiran, susunan)
        values (
          v_sk_id,
          coalesce(v_sp->>'kod', ''),
          coalesce(v_sp->>'pernyataan', ''),
          coalesce(v_sp->'butiran', '[]'::jsonb),
          v_p_idx
        );
        v_p_idx := v_p_idx + 1;
      end loop;
    end loop;
  end loop;

  return v_doc_id;
end;
$$;

revoke all on function public.simpan_dskp(jsonb) from public;
grant execute on function public.simpan_dskp(jsonb) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage: bucket fail PDF
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('dskp-pdf', 'dskp-pdf', false)
on conflict (id) do nothing;

drop policy if exists "anon upload dskp pdf" on storage.objects;
create policy "anon upload dskp pdf"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'dskp-pdf');

drop policy if exists "anon baca dskp pdf" on storage.objects;
create policy "anon baca dskp pdf"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'dskp-pdf');

drop policy if exists "anon padam dskp pdf" on storage.objects;
create policy "anon padam dskp pdf"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'dskp-pdf');

-- ---------------------------------------------------------------------------
-- Jadual waktu dan RPH
-- ---------------------------------------------------------------------------

create table if not exists public.jadual_waktu (
  id uuid primary key default gen_random_uuid(),
  nama_fail text,
  created_at timestamptz not null default now()
);

create table if not exists public.sesi_pdp (
  id uuid primary key default gen_random_uuid(),
  jadual_id uuid references public.jadual_waktu(id) on delete cascade,
  kelas text not null,
  tingkatan text,
  hari text not null,
  masa text not null,
  masa_mula text,
  masa_tamat text,
  mata_pelajaran text not null,
  susunan integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.rph (
  id uuid primary key default gen_random_uuid(),
  sesi_id uuid references public.sesi_pdp(id) on delete set null,
  tarikh date,
  hari text,
  masa text,
  tingkatan text,
  kelas text,
  mata_pelajaran text,
  bidang_kod text,
  bidang_nama text,
  sk_kod text,
  sk_tajuk text,
  standard_pembelajaran jsonb not null default '[]'::jsonb,
  objektif jsonb not null default '[]'::jsonb,
  bbm text,
  nilai text,
  aktiviti jsonb not null default '[]'::jsonb,
  refleksi_peratus integer,
  refleksi_berjaya boolean,
  refleksi_catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sesi_pdp_hari_idx on public.sesi_pdp (hari, susunan);
create index if not exists rph_tarikh_idx on public.rph (tarikh desc);

alter table public.jadual_waktu enable row level security;
alter table public.sesi_pdp enable row level security;
alter table public.rph enable row level security;

drop policy if exists "baca jadual waktu" on public.jadual_waktu;
create policy "baca jadual waktu" on public.jadual_waktu for select using (true);

drop policy if exists "baca sesi pdp" on public.sesi_pdp;
create policy "baca sesi pdp" on public.sesi_pdp for select using (true);

drop policy if exists "baca rph" on public.rph;
create policy "baca rph" on public.rph for select using (true);

drop policy if exists "tulis jadual waktu" on public.jadual_waktu;
create policy "tulis jadual waktu" on public.jadual_waktu for all using (true) with check (true);

drop policy if exists "tulis sesi pdp" on public.sesi_pdp;
create policy "tulis sesi pdp" on public.sesi_pdp for all using (true) with check (true);

create or replace function public.simpan_jadual_waktu(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jadual_id uuid;
  v_sesi jsonb;
  v_idx int := 0;
begin
  delete from public.sesi_pdp where id is not null;
  delete from public.jadual_waktu where id is not null;

  insert into public.jadual_waktu (nama_fail)
  values (nullif(payload->>'nama_fail', ''))
  returning id into v_jadual_id;

  for v_sesi in select value from jsonb_array_elements(coalesce(payload->'sesi', '[]'::jsonb))
  loop
    insert into public.sesi_pdp (
      jadual_id, kelas, tingkatan, hari, masa, masa_mula, masa_tamat, mata_pelajaran, susunan
    ) values (
      v_jadual_id,
      coalesce(v_sesi->>'kelas', ''),
      nullif(v_sesi->>'tingkatan', ''),
      coalesce(v_sesi->>'hari', ''),
      coalesce(v_sesi->>'masa', ''),
      nullif(v_sesi->>'masa_mula', ''),
      nullif(v_sesi->>'masa_tamat', ''),
      coalesce(v_sesi->>'mata_pelajaran', ''),
      v_idx
    );
    v_idx := v_idx + 1;
  end loop;

  return v_jadual_id;
end;
$$;

create or replace function public.simpan_rph(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_sesi uuid;
begin
  v_id := nullif(payload->>'id', '')::uuid;
  v_sesi := nullif(payload->>'sesi_id', '')::uuid;

  if v_id is null then
    insert into public.rph (
      sesi_id, tarikh, hari, masa, tingkatan, kelas, mata_pelajaran,
      bidang_kod, bidang_nama, sk_kod, sk_tajuk, standard_pembelajaran,
      objektif, bbm, nilai, aktiviti, refleksi_peratus, refleksi_berjaya, refleksi_catatan
    ) values (
      v_sesi,
      nullif(payload->>'tarikh', '')::date,
      nullif(payload->>'hari', ''),
      nullif(payload->>'masa', ''),
      nullif(payload->>'tingkatan', ''),
      nullif(payload->>'kelas', ''),
      nullif(payload->>'mata_pelajaran', ''),
      nullif(payload->>'bidang_kod', ''),
      nullif(payload->>'bidang_nama', ''),
      nullif(payload->>'sk_kod', ''),
      nullif(payload->>'sk_tajuk', ''),
      coalesce(payload->'standard_pembelajaran', '[]'::jsonb),
      coalesce(payload->'objektif', '[]'::jsonb),
      nullif(payload->>'bbm', ''),
      nullif(payload->>'nilai', ''),
      coalesce(payload->'aktiviti', '[]'::jsonb),
      nullif(payload->>'refleksi_peratus', '')::integer,
      case
        when payload->>'refleksi_berjaya' is null then null
        else (payload->>'refleksi_berjaya')::boolean
      end,
      nullif(payload->>'refleksi_catatan', '')
    ) returning id into v_id;
  else
    update public.rph set
      sesi_id = v_sesi,
      tarikh = nullif(payload->>'tarikh', '')::date,
      hari = nullif(payload->>'hari', ''),
      masa = nullif(payload->>'masa', ''),
      tingkatan = nullif(payload->>'tingkatan', ''),
      kelas = nullif(payload->>'kelas', ''),
      mata_pelajaran = nullif(payload->>'mata_pelajaran', ''),
      bidang_kod = nullif(payload->>'bidang_kod', ''),
      bidang_nama = nullif(payload->>'bidang_nama', ''),
      sk_kod = nullif(payload->>'sk_kod', ''),
      sk_tajuk = nullif(payload->>'sk_tajuk', ''),
      standard_pembelajaran = coalesce(payload->'standard_pembelajaran', standard_pembelajaran),
      objektif = coalesce(payload->'objektif', objektif),
      bbm = nullif(payload->>'bbm', ''),
      nilai = nullif(payload->>'nilai', ''),
      aktiviti = coalesce(payload->'aktiviti', aktiviti),
      refleksi_peratus = nullif(payload->>'refleksi_peratus', '')::integer,
      refleksi_berjaya = case
        when payload->>'refleksi_berjaya' is null then refleksi_berjaya
        else (payload->>'refleksi_berjaya')::boolean
      end,
      refleksi_catatan = nullif(payload->>'refleksi_catatan', ''),
      updated_at = now()
    where id = v_id;
    if not found then
      raise exception 'RPH tidak dijumpai';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.simpan_jadual_waktu(jsonb) from public;
grant execute on function public.simpan_jadual_waktu(jsonb) to anon, authenticated, service_role;
revoke all on function public.simpan_rph(jsonb) from public;
grant execute on function public.simpan_rph(jsonb) to anon, authenticated, service_role;

drop policy if exists "tulis rph" on public.rph;
create policy "tulis rph" on public.rph for all using (true) with check (true);

create or replace function public.simpan_rph_pukal(senarai jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_bil int := 0;
begin
  for v_item in select value from jsonb_array_elements(coalesce(senarai, '[]'::jsonb))
  loop
    perform public.simpan_rph(v_item);
    v_bil := v_bil + 1;
  end loop;
  return v_bil;
end;
$$;

revoke all on function public.simpan_rph_pukal(jsonb) from public;
grant execute on function public.simpan_rph_pukal(jsonb) to anon, authenticated, service_role;

create or replace function public.padam_rph_tahun(tarikh_mula date, tarikh_tamat date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bil int;
begin
  delete from public.rph
  where tarikh is not null
    and tarikh >= tarikh_mula
    and tarikh <= tarikh_tamat;
  get diagnostics v_bil = row_count;
  return v_bil;
end;
$$;

revoke all on function public.padam_rph_tahun(date, date) from public;
grant execute on function public.padam_rph_tahun(date, date) to anon, authenticated, service_role;

create or replace function public.padam_semua_rph()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bil int;
begin
  delete from public.rph where id is not null;
  get diagnostics v_bil = row_count;
  return v_bil;
end;
$$;

revoke all on function public.padam_semua_rph() from public;
grant execute on function public.padam_semua_rph() to anon, authenticated, service_role;

create or replace function public.padam_rph_ids(ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bil int;
begin
  delete from public.rph where id = any(ids);
  get diagnostics v_bil = row_count;
  return v_bil;
end;
$$;

revoke all on function public.padam_rph_ids(uuid[]) from public;
grant execute on function public.padam_rph_ids(uuid[]) to anon, authenticated, service_role;
