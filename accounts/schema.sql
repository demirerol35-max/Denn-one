-- Run in Supabase SQL Editor. Auth handled by Supabase Auth.
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 updated_at timestamptz not null default now(),
 constraint display_name_length check (char_length(display_name)<=40)
);
create table if not exists public.user_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 progress_key text not null,
 progress_value jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(),
 primary key(user_id,progress_key)
);
create table if not exists public.mosque_suggestions (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 3 and 150),
 location_input text not null check (char_length(location_input)<=1000),
 address text not null default '' check (char_length(address)<=500),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.user_progress enable row level security;
alter table public.mosque_suggestions enable row level security;
create policy "profiles owner read" on public.profiles for select to authenticated using (auth.uid()=id);
create policy "profiles owner insert" on public.profiles for insert to authenticated with check (auth.uid()=id);
create policy "profiles owner update" on public.profiles for update to authenticated using (auth.uid()=id) with check(auth.uid()=id);
create policy "progress owner read" on public.user_progress for select to authenticated using(auth.uid()=user_id);
create policy "progress owner insert" on public.user_progress for insert to authenticated with check(auth.uid()=user_id);
create policy "progress owner update" on public.user_progress for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "suggestions owner read" on public.mosque_suggestions for select to authenticated using(auth.uid()=user_id);
create policy "suggestions owner submit" on public.mosque_suggestions for insert to authenticated with check(auth.uid()=user_id and status='pending');
-- No public update/delete policy. Review in Supabase dashboard with administrator privileges.
-- Add server-side abuse controls (rate limits/CAPTCHA) before public launch.
