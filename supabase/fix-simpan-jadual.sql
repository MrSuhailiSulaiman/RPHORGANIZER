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
