create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  theme_name text not null default 'midnight'
    check (theme_name in ('midnight', 'beige', 'lime', 'pink', 'sky')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_preferences_unique_user unique (user_id)
);

create index if not exists user_preferences_user_id_idx
  on public.user_preferences (user_id);

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();

alter table public.user_preferences enable row level security;

drop policy if exists "Users can select own user preferences" on public.user_preferences;
create policy "Users can select own user preferences"
on public.user_preferences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own user preferences" on public.user_preferences;
create policy "Users can insert own user preferences"
on public.user_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own user preferences" on public.user_preferences;
create policy "Users can update own user preferences"
on public.user_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own user preferences" on public.user_preferences;
create policy "Users can delete own user preferences"
on public.user_preferences
for delete
to authenticated
using (auth.uid() = user_id);
