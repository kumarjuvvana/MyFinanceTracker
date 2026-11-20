begin;

create table if not exists public.devotional_songs (
  id text primary key,
  position integer not null,
  record jsonb not null
);

alter table public.devotional_songs enable row level security;
revoke all on table public.devotional_songs from public, anon, authenticated;
grant select, insert, update, delete on table public.devotional_songs to service_role;

create or replace function public.save_daybook_data_with_devotional_songs(
  p_data jsonb,
  p_expected_revision text
)
returns table (revision text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_revision text;
begin
  select saved.revision into saved_revision
  from public.save_daybook_data_with_cooking_inventory(
    p_data - 'devotionalSongs',
    p_expected_revision
  ) as saved;
  if saved_revision is null then
    return;
  end if;

  if p_data ? 'devotionalSongs' then
    if pg_catalog.jsonb_typeof(p_data -> 'devotionalSongs') <> 'array' then
      raise exception 'Daybook collection devotionalSongs must be a JSON array';
    end if;

    delete from public.devotional_songs where id is not null;
    insert into public.devotional_songs (id, position, record)
    select song.entry ->> 'id', song.entry_position::integer, song.entry
    from pg_catalog.jsonb_array_elements(p_data -> 'devotionalSongs')
      with ordinality as song(entry, entry_position);
  end if;

  revision := saved_revision;
  return next;
end;
$$;

create or replace function public.load_daybook_data_with_devotional_songs()
returns table (data jsonb, revision text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored record;
begin
  select current_data.data, current_data.revision into stored
  from public.load_daybook_data_with_account_credentials() as current_data;
  if not found then
    return;
  end if;

  data := stored.data || pg_catalog.jsonb_build_object(
    'devotionalSongs',
    coalesce(
      (
        select pg_catalog.jsonb_agg(song.record order by song.position)
        from public.devotional_songs as song
      ),
      '[]'::jsonb
    )
  );
  revision := stored.revision;
  return next;
end;
$$;

revoke all on function public.save_daybook_data_with_devotional_songs(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_daybook_data_with_devotional_songs(jsonb, text) to service_role;
revoke all on function public.load_daybook_data_with_devotional_songs() from public, anon, authenticated;
grant execute on function public.load_daybook_data_with_devotional_songs() to service_role;

notify pgrst, 'reload schema';
commit;
