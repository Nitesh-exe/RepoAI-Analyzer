In Supabase → SQL Editor, eventually we'll create:
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    age integer not null,
    phone text not null unique,
    created_at timestamptz not null default now()
);