In Supabase → SQL Editor, eventually we'll create:
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    age integer not null,
    phone text not null unique,
    created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (
        id,
        full_name,
        age,
        phone
    )
    values (
        new.id,
        new.raw_user_meta_data ->> 'full_name',
        (new.raw_user_meta_data ->> 'age')::integer,
        new.raw_user_meta_data ->> 'phone'
    );

    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute procedure public.handle_new_user();

create table public.projects (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    name text not null,

    source text not null
        check (source in ('upload', 'github')),

    repository_url text,

    created_at timestamptz not null default now(),

    last_accessed_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Users can view their own projects"
on public.projects
for select
using (auth.uid() = user_id);

create policy "Users can create their own projects"
on public.projects
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own projects"
on public.projects
for update
using (auth.uid() = user_id);

create policy "Users can delete their own projects"
on public.projects
for delete
using (auth.uid() = user_id);

create index projects_user_id_idx
on public.projects(user_id);

create index projects_last_accessed_idx
on public.projects(last_accessed_at desc);

create table public.sessions (
    id uuid primary key default gen_random_uuid(),

    project_id uuid not null
        references public.projects(id)
        on delete cascade,

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    started_at timestamptz not null default now(),

    last_accessed_at timestamptz not null default now()
);

alter table public.sessions enable row level security;

create policy "Users can view their own sessions"
on public.sessions
for select
using (auth.uid() = user_id);

create policy "Users can create their own sessions"
on public.sessions
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own sessions"
on public.sessions
for update
using (auth.uid() = user_id);

create policy "Users can delete their own sessions"
on public.sessions
for delete
using (auth.uid() = user_id);

create index sessions_user_id_idx
on public.sessions(user_id);

create index sessions_project_id_idx
on public.sessions(project_id);

create index sessions_last_accessed_idx
on public.sessions(last_accessed_at desc);

Create migrations

Run:

python manage.py makemigrations
python manage.py migrate

Django will create its own local development database unless you've configured Postgres.