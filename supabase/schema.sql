-- Execute este arquivo no SQL Editor do seu projeto Supabase.
create table if not exists public.escalas_aprovacao (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('rascunho','aguardando_aprovacao','aprovada','devolvida','publicada')) default 'aguardando_aprovacao',
  payload jsonb not null,
  motivo_devolucao text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  role text not null default 'montador' check (role in ('montador','lider'))
);

alter table public.escalas_aprovacao enable row level security;
alter table public.profiles enable row level security;

create or replace function public.is_lider() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='lider');
$$;

create policy "authenticated can read scales" on public.escalas_aprovacao for select to authenticated using (true);
create policy "owner can create scale" on public.escalas_aprovacao for insert to authenticated with check (created_by=auth.uid());
drop policy if exists "owner or leader can update scale" on public.escalas_aprovacao;
create policy "owner or leader can update scale" on public.escalas_aprovacao for update to authenticated using ((created_by=auth.uid() and status in ('rascunho','aguardando_aprovacao','devolvida')) or public.is_lider()) with check ((created_by=auth.uid() and status in ('rascunho','aguardando_aprovacao','devolvida')) or public.is_lider());
create policy "owner can delete scale" on public.escalas_aprovacao for delete to authenticated using (created_by=auth.uid() or public.is_lider());

create policy "read own profile" on public.profiles for select to authenticated using (id=auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id) values(new.id) on conflict do nothing; return new; end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Depois de criar o usuário do líder, execute:
-- update public.profiles set role='lider', nome='Nome do Líder' where id='UUID_DO_USUARIO';
