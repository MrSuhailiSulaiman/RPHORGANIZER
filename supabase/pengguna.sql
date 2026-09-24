-- Akaun, peranan, dan pemilikan RPH/jadual. DSKP kekal dikongsi.
-- Jalankan dalam SQL Editor projek Supabase.

create extension if not exists "pgcrypto";

create table if not exists public.pengguna (
  id uuid primary key default gen_random_uuid(),
  nama_pengguna text not null unique,
  kata_laluan_hash text not null,
  peranan text not null default 'pengguna' check (peranan in ('admin', 'pengguna')),
  created_at timestamptz not null default now()
);

alter table public.pengguna enable row level security;
drop policy if exists "baca pengguna" on public.pengguna;
create policy "baca pengguna" on public.pengguna for select using (true);
drop policy if exists "tulis pengguna" on public.pengguna;
create policy "tulis pengguna" on public.pengguna for all using (true) with check (true);
grant all on public.pengguna to anon, authenticated, service_role;

alter table public.rph add column if not exists pengguna_id uuid references public.pengguna(id) on delete cascade;
alter table public.jadual_waktu add column if not exists pengguna_id uuid references public.pengguna(id) on delete cascade;
alter table public.sesi_pdp add column if not exists pengguna_id uuid references public.pengguna(id) on delete cascade;

create index if not exists rph_pengguna_idx on public.rph (pengguna_id, tarikh desc);
create index if not exists jadual_pengguna_idx on public.jadual_waktu (pengguna_id, created_at desc);
create index if not exists sesi_pengguna_idx on public.sesi_pdp (pengguna_id, susunan);

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
  v_pengguna uuid;
begin
  v_pengguna := nullif(payload->>'pengguna_id', '')::uuid;
  if v_pengguna is null then
    raise exception 'pengguna_id diperlukan';
  end if;

  delete from public.sesi_pdp
  where pengguna_id = v_pengguna
     or jadual_id in (select id from public.jadual_waktu where pengguna_id = v_pengguna);
  delete from public.jadual_waktu where pengguna_id = v_pengguna;

  insert into public.jadual_waktu (nama_fail, pengguna_id)
  values (nullif(payload->>'nama_fail', ''), v_pengguna)
  returning id into v_jadual_id;

  for v_sesi in select value from jsonb_array_elements(coalesce(payload->'sesi', '[]'::jsonb))
  loop
    insert into public.sesi_pdp (
      jadual_id, kelas, tingkatan, hari, masa, masa_mula, masa_tamat, mata_pelajaran, susunan, pengguna_id
    ) values (
      v_jadual_id,
      coalesce(v_sesi->>'kelas', ''),
      nullif(v_sesi->>'tingkatan', ''),
      coalesce(v_sesi->>'hari', ''),
      coalesce(v_sesi->>'masa', ''),
      nullif(v_sesi->>'masa_mula', ''),
      nullif(v_sesi->>'masa_tamat', ''),
      coalesce(v_sesi->>'mata_pelajaran', ''),
      v_idx,
      v_pengguna
    );
    v_idx := v_idx + 1;
  end loop;

  return v_jadual_id;
end;
$$;

-- refleksi_berjaya: boolean -> varchar supaya boleh menyimpan lebih daripada dua nilai.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rph'
      and column_name = 'refleksi_berjaya'
      and udt_name = 'bool'
  ) then
    alter table public.rph
      alter column refleksi_berjaya drop default;
    alter table public.rph
      alter column refleksi_berjaya type varchar
      using (
        case
          when refleksi_berjaya is true then 'berjaya'
          when refleksi_berjaya is false then 'tidak'
          else 'belum'
        end
      );
  end if;
end $$;

alter table public.rph alter column refleksi_berjaya set default 'belum';

update public.rph
set refleksi_berjaya = 'belum'
where refleksi_berjaya is null or btrim(refleksi_berjaya) = '';

create or replace function public.nilai_refleksi_berjaya(nilai text)
returns varchar
language sql
immutable
as $$
  select case
    when lower(btrim(coalesce(nilai, ''))) in ('true', 'ya', 'berjaya') then 'berjaya'
    when lower(btrim(coalesce(nilai, ''))) in ('false', 'tidak', 'tidak berjaya') then 'tidak'
    when btrim(coalesce(nilai, '')) = '' then 'belum'
    when lower(btrim(nilai)) in ('belum', 'belum dilaksanakan') then 'belum'
    else btrim(nilai)
  end::varchar;
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
  v_pengguna uuid;
begin
  v_id := nullif(payload->>'id', '')::uuid;
  v_sesi := nullif(payload->>'sesi_id', '')::uuid;
  v_pengguna := nullif(payload->>'pengguna_id', '')::uuid;

  if v_id is null then
    insert into public.rph (
      sesi_id, tarikh, hari, masa, tingkatan, kelas, mata_pelajaran,
      bidang_kod, bidang_nama, sk_kod, sk_tajuk, standard_pembelajaran,
      objektif, bbm, nilai, aktiviti, refleksi_peratus, refleksi_berjaya, refleksi_catatan,
      pengguna_id
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
      public.nilai_refleksi_berjaya(payload->>'refleksi_berjaya'),
      nullif(payload->>'refleksi_catatan', ''),
      v_pengguna
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
        when payload ? 'refleksi_berjaya' then public.nilai_refleksi_berjaya(payload->>'refleksi_berjaya')
        else coalesce(refleksi_berjaya, 'belum')
      end,
      refleksi_catatan = nullif(payload->>'refleksi_catatan', ''),
      pengguna_id = coalesce(pengguna_id, v_pengguna),
      updated_at = now()
    where id = v_id
      and (v_pengguna is null or pengguna_id is null or pengguna_id = v_pengguna);
    if not found then
      raise exception 'RPH tidak dijumpai';
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.padam_rph_pengguna(p_pengguna_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bil int;
begin
  delete from public.rph where pengguna_id = p_pengguna_id;
  get diagnostics v_bil = row_count;
  return v_bil;
end;
$$;

revoke all on function public.simpan_jadual_waktu(jsonb) from public;
grant execute on function public.simpan_jadual_waktu(jsonb) to anon, authenticated, service_role;
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

revoke all on function public.simpan_rph(jsonb) from public;
grant execute on function public.simpan_rph(jsonb) to anon, authenticated, service_role;
revoke all on function public.simpan_rph_pukal(jsonb) from public;
grant execute on function public.simpan_rph_pukal(jsonb) to anon, authenticated, service_role;
revoke all on function public.padam_rph_pengguna(uuid) from public;
grant execute on function public.padam_rph_pengguna(uuid) to anon, authenticated, service_role;
