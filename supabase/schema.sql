-- ============================================
-- SONORA — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'user_' || substr(new.id::text, 1, 8),
    coalesce(new.raw_user_meta_data->>'full_name', 'Music Maker')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tracks
create table public.tracks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  prompt text not null,
  genre text,
  mood text,
  lyrics text,
  description text,
  tags text[] default '{}',
  duration_seconds integer,
  audio_url text,
  waveform_data jsonb,
  parent_track_id uuid references public.tracks(id) on delete set null,
  is_remix boolean default false,
  is_public boolean default false,
  share_slug text unique,
  play_count integer default 0,
  replicate_prediction_id text,
  status text default 'pending' check (status in ('pending', 'generating', 'completed', 'failed')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.tracks enable row level security;

create policy "Users can view own tracks"
  on public.tracks for select using (auth.uid() = user_id);

create policy "Anyone can view public tracks"
  on public.tracks for select using (is_public = true);

create policy "Users can insert own tracks"
  on public.tracks for insert with check (auth.uid() = user_id);

create policy "Users can update own tracks"
  on public.tracks for update using (auth.uid() = user_id);

create policy "Users can delete own tracks"
  on public.tracks for delete using (auth.uid() = user_id);

-- Indexes
create index idx_tracks_user_id on public.tracks(user_id);
create index idx_tracks_share_slug on public.tracks(share_slug);
create index idx_tracks_parent on public.tracks(parent_track_id);
create index idx_tracks_status on public.tracks(status);
create index idx_tracks_created on public.tracks(created_at desc);

-- Updated_at trigger
create or replace function public.update_modified_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_tracks_updated_at
  before update on public.tracks
  for each row execute function public.update_modified_column();

-- Storage bucket for audio files
insert into storage.buckets (id, name, public) values ('tracks', 'tracks', true);

create policy "Anyone can read public track audio"
  on storage.objects for select using (bucket_id = 'tracks');

create policy "Authenticated users can upload audio"
  on storage.objects for insert
  with check (bucket_id = 'tracks' and auth.role() = 'authenticated');

create policy "Users can delete own audio"
  on storage.objects for delete
  using (bucket_id = 'tracks' and auth.uid()::text = (storage.foldername(name))[1]);
